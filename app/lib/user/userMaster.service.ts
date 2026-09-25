import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { BusinessRuleError, ForbiddenError, NotFoundError, ValidationError, type FieldErrors } from '@/lib/http/errors';
import { ResourceService, adminOnly, menuPolicy, type ResourceAction, type ResourceDefinition } from '@/lib/resource';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { hashPassword } from '@/lib/auth/password';
import { validatePasswordRules, validateUsernameRules } from '@/lib/auth/credentialPolicy';
import { assertPasswordAllowed, setUserPassword } from '@/lib/auth/passwordService';
import { USER_STATUS, userStatusId } from '@/lib/auth/userStatus';
import { getMasterId, masterNames } from '@/lib/masters/masterService';
import {
  userMasterCreateSchema,
  userMasterUpdateSchema,
  userStatusActionSchema,
  type UserMasterCreateInput,
  type UserMasterUpdateInput,
} from '@/validations/user.schema';
import { ACTIVE_BOOL, adminWrites, findDomainInScope, intFilter, nameMaps, num, roleErrors, str, tenantWhere, throwIfErrors } from './userScope';
import { permissionClassForNewUser } from './userTypeRoleMapping.resource';

/**
 * User Master — CI controllers/user/user_master.php (+ models/user/user_master_m.php).
 *
 * List (CI user_mst_vw, rebuilt from user_mst + user_domain + org_accounts + oa_brands +
 * independent_mst): sysadmin all, admin own organisation, user own record.
 * Create (one transaction): user_mst, user_password_history, emp_mst, user_role rows and the
 * default permission_dtl row (ref type 65) — CI user_master::setFormControls().
 * Secrets (PASSWORD, TPIN, MEMORABLE_WORD, answers, tokens) are never selected into responses.
 */

const USER_CONTACT_TYPE_ID = 47; // common_type 'UCT' (CI getMastersByTypeCodeAndAppID('UCT', …))
const PERMISSION_REF_TYPE_USER = 65; // CI set_default_class_for_employee: PERMISSIONS_REF_TYPE_ID = 65
const AUTO_ACTIVATION_CODE = 'OASAAA';
const EMP_STATUS_CURRENT = 'EMSC';

/** Columns ever read from user_mst by this module — no secrets (ACTIVATION is reduced to a flag). */
const SAFE_SELECT = {
  USER_ID: true,
  USER_NAME: true,
  REG_EMAIL_ID: true,
  FIRST_NAME: true,
  LAST_NAME: true,
  USER_STATUS_ID: true,
  EXT_REF_NBR: true,
  LAST_LOGIN_AT: true,
  DMN_ID: true,
  ACTIVATION: true,
  IS_ADMIN: true,
  IS_SYSADMIN: true,
  USER_TYP_ID: true,
  IS_PREDEFINED: true,
  OA_ID: true,
  OA_BRAND_ID: true,
  FAILED_LOGIN_ATTEMPTS: true,
  CREATED_ON: true,
} as const;

export interface UserMasterDto {
  id: number;
  userName: string;
  regEmail: string;
  fullName: string | null;
  extRefId: string | null;
  domainId: number | null;
  domainName: string | null;
  oaId: number | null;
  organisation: string | null;
  oaBrandId: number | null;
  brandName: string | null;
  statusId: number;
  statusCode: string | null;
  statusName: string | null;
  userTypeId: number | null;
  userTypeName: string | null;
  isAdmin: boolean;
  isSysAdmin: boolean;
  isPredefined: boolean;
  /** CI getIsActivated: ACTIVATION token cleared. */
  activated: boolean;
  lastLoginAt: string | null;
  failedLoginAttempts: number;
  roleIds: number[];
  roleNames: string;
}

/** user_mst.IS_ADMIN is smallint in the database (2 on sysadmin rows) but Boolean in Prisma. */
function isSysAdminRow(r: Record<string, unknown>) {
  return r.IS_SYSADMIN === true || Number(r.IS_ADMIN) === 2;
}

const policy = adminWrites(menuPolicy('user/user_master', adminOnly), { allowUserUpdate: true });

const definition: ResourceDefinition<never, never, UserMasterDto> = {
  label: 'User',
  model: 'user_mst',
  primaryKey: 'USER_ID',
  select: SAFE_SELECT,
  searchFields: ['USER_NAME', 'REG_EMAIL_ID', 'EXT_REF_NBR', 'FIRST_NAME', 'LAST_NAME'],
  sortFields: ['USER_ID', 'USER_NAME', 'REG_EMAIL_ID', 'LAST_LOGIN_AT', 'USER_STATUS_ID', 'DMN_ID', 'OA_BRAND_ID'],
  defaultSort: { field: 'USER_ID', dir: 'desc' },
  filters: {
    domainId: { column: 'DMN_ID', parse: intFilter },
    brandId: { column: 'OA_BRAND_ID', parse: intFilter },
  },
  tenancy: { mode: 'ci', scopeBy: 'org', orgColumn: 'OA_ID', brandColumn: 'OA_BRAND_ID', ownerColumn: 'USER_ID' },
  softDelete: { column: 'IS_DELETED', deleted: true, active: false, nullIsActive: true },
  audit: { updatedBy: 'UPDATED_BY', updatedOn: 'UPDATED_ON' },
  policy,
  hooks: {
    async beforeDelete(id, existing, ctx) {
      if (existing.IS_PREDEFINED === true) throw new BusinessRuleError('Cannot delete default user', 'PREDEFINED');
      if (id === ctx.subject.userId) throw new BusinessRuleError('You cannot delete your own account.', 'SELF');
      if (ctx.subject.adminLevel < 2 && isSysAdminRow(existing)) throw new ForbiddenError();
    },
    async enrichRows(rows) {
      const ids = rows.map((r) => r.USER_ID as number);
      const [names, masters, roles] = await Promise.all([
        nameMaps(rows, { domain: 'DMN_ID', brand: 'OA_BRAND_ID', org: 'OA_ID' }),
        masterNames(rows.flatMap((r) => [r.USER_STATUS_ID as number, r.USER_TYP_ID as number])),
        prisma.user_role.findMany({ where: { USER_ID: { in: ids }, IS_DELETED: 0 }, select: { USER_ID: true, ROLE_ID: true } }),
      ]);
      const roleNames = await nameMaps(roles as unknown as Record<string, unknown>[], { role: 'ROLE_ID' });
      const byUser = new Map<number, number[]>();
      for (const r of roles) byUser.set(r.USER_ID, [...(byUser.get(r.USER_ID) ?? []), r.ROLE_ID]);
      return rows.map((r) => {
        const roleIds = [...new Set(byUser.get(r.USER_ID as number) ?? [])];
        return {
          ...r,
          _domain: names.domain.get(r.DMN_ID as number) ?? null,
          _brand: names.brand.get(r.OA_BRAND_ID as number) ?? null,
          _org: names.org.get(r.OA_ID as number) ?? null,
          _status: masters.get(r.USER_STATUS_ID as number) ?? null,
          _userType: masters.get(r.USER_TYP_ID as number)?.name ?? null,
          _roleIds: roleIds,
          _roleNames: roleIds.map((id) => roleNames.role.get(id)).filter(Boolean).join(', '),
        };
      });
    },
  },
  toDto: (r) => {
    const status = r._status as { name: string; code: string | null } | null;
    return {
      id: r.USER_ID as number,
      userName: (r.USER_NAME as string) ?? '',
      regEmail: (r.REG_EMAIL_ID as string) ?? '',
      fullName: [str(r.FIRST_NAME), str(r.LAST_NAME)].filter(Boolean).join(' ') || null,
      extRefId: str(r.EXT_REF_NBR),
      domainId: num(r.DMN_ID),
      domainName: str(r._domain),
      oaId: num(r.OA_ID),
      organisation: str(r._org),
      oaBrandId: num(r.OA_BRAND_ID),
      brandName: str(r._brand),
      statusId: r.USER_STATUS_ID as number,
      statusCode: status?.code ?? null,
      statusName: status?.name ?? null,
      userTypeId: num(r.USER_TYP_ID),
      userTypeName: str(r._userType),
      isAdmin: Boolean(r.IS_ADMIN) && Number(r.IS_ADMIN) !== 0,
      isSysAdmin: isSysAdminRow(r),
      isPredefined: r.IS_PREDEFINED === true,
      activated: !r.ACTIVATION,
      lastLoginAt: r.LAST_LOGIN_AT instanceof Date ? r.LAST_LOGIN_AT.toISOString() : null,
      failedLoginAttempts: num(r.FAILED_LOGIN_ATTEMPTS) ?? 0,
      roleIds: (r._roleIds as number[]) ?? [],
      roleNames: (r._roleNames as string) ?? '',
    };
  },
};

const resource = new ResourceService(definition);

// ---------------------------------------------------------------- helpers

async function authorize(subject: RequestSubject, action: ResourceAction) {
  if (!(await policy.check(subject, action))) throw new ForbiddenError();
}

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new ValidationError('Invalid id.', { id: ['Must be a positive integer.'] });
  return id;
}

/** CI oa_brand_settings_m::getOabsValue(brand, 'OASAAA') === 1 (missing row on a real brand → no). */
async function isAutoActivation(oaBrandId: number): Promise<boolean> {
  const attributeId = await getMasterId(AUTO_ACTIVATION_CODE);
  if (!attributeId) return false;
  const row = await prisma.oa_brand_settings.findFirst({
    where: { OA_BRAND_ID: oaBrandId, OABS_ATTRBUTE_ID: attributeId },
    orderBy: { OAB_SETTING_ID: 'asc' },
    select: { OABS_SETTING_VALUE: true },
  });
  const value = (row?.OABS_SETTING_VALUE ?? '').trim().toLowerCase();
  return value === '1' || value === 'yes';
}

async function validateUserType(userTypeId: number | undefined): Promise<string[]> {
  if (!userTypeId) return [];
  const row = await prisma.independent_mst.findFirst({
    where: { MSTR_ID: userTypeId, TYP_ID: USER_CONTACT_TYPE_ID },
    select: { MSTR_ID: true },
  });
  return row ? [] : ['Select a valid user type.'];
}

async function emailErrors(email: string, exceptUserId?: number): Promise<string[]> {
  const clash = await prisma.user_mst.findFirst({
    where: {
      REG_EMAIL_ID: { equals: email, mode: 'insensitive' },
      ...ACTIVE_BOOL,
      ...(exceptUserId ? { NOT: { USER_ID: exceptUserId } } : {}),
    },
    select: { USER_ID: true },
  });
  return clash ? ['Email ID already exists'] : [];
}

/** CI checkUserNameDmnId: "Combination of Domain Name And UserName already exists". */
async function userDomainComboErrors(userName: string, domainId: number, exceptUserId?: number): Promise<string[]> {
  const clash = await prisma.user_mst.findFirst({
    where: {
      USER_NAME: { equals: userName, mode: 'insensitive' },
      DMN_ID: domainId,
      ...ACTIVE_BOOL,
      ...(exceptUserId ? { NOT: { USER_ID: exceptUserId } } : {}),
    },
    select: { USER_ID: true },
  });
  return clash ? ['Combination of Domain Name And UserName already exists'] : [];
}

function setAdminFlagSql(userId: number, isAdmin: boolean) {
  // IS_ADMIN is a smallint column mapped as Boolean by Prisma: written with an explicit cast.
  return Prisma.sql`UPDATE "user_mst" SET "IS_ADMIN" = ${isAdmin ? 1 : 0}::smallint WHERE "USER_ID" = ${userId}`;
}

// ---------------------------------------------------------------- create

async function create(subject: RequestSubject, body: unknown): Promise<UserMasterDto> {
  await authorize(subject, 'create');
  const input: UserMasterCreateInput = userMasterCreateSchema.parse(body);
  const domain = await findDomainInScope(subject, input.domainId, 'org');
  const brandId = domain.OA_BRAND_ID;

  const errors: FieldErrors = {
    userName: [
      ...(await validateUsernameRules(input.userName, brandId)),
      ...(await userDomainComboErrors(input.userName, domain.DMN_ID)),
    ],
    regEmail: await emailErrors(input.regEmail),
    password: await validatePasswordRules(input.password, brandId),
    roleIds: await roleErrors(input.roleIds, brandId),
    userTypeId: await validateUserType(input.userTypeId),
    isAdmin: input.isAdmin && subject.adminLevel < 1 ? ['Only an administrator can create administrators.'] : [],
  };
  throwIfErrors(errors);

  for (const [table, pk] of [
    ['user_mst', 'USER_ID'],
    ['user_password_history', 'ID'],
    ['emp_mst', 'EMP_ID'],
    ['user_role', 'USER_ROLE_ID'],
    ['permission_dtl', 'PERMISSIONS_DTL_ID'],
  ] as const) {
    await assertInsertSafe(table, pk);
  }

  const autoActivate = await isAutoActivation(brandId);
  const [statusId, empStatusId, permissionClassId, hash] = await Promise.all([
    userStatusId(autoActivate ? USER_STATUS.ACTIVE : USER_STATUS.PENDING_ACTIVATION),
    getMasterId(EMP_STATUS_CURRENT),
    permissionClassForNewUser(input.userTypeId, input.roleIds),
    hashPassword(input.password),
  ]);
  const activation = autoActivate ? null : crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const actor = subject.userId;

  const userId = await prisma.$transaction(async (tx) => {
    const user = await tx.user_mst.create({
      data: {
        USER_NAME: input.userName,
        REG_EMAIL_ID: input.regEmail,
        PASSWORD: hash,
        USER_STATUS_ID: statusId,
        EXT_REF_NBR: input.extRefId,
        // Prisma marks LAST_LOGIN_AT NOT NULL; the creation time is used (the epoch would make the
        // inactivity-suspension rule treat every new account as long inactive).
        LAST_LOGIN_AT: now,
        DMN_ID: domain.DMN_ID,
        ACTIVATION: activation,
        IS_PREDEFINED: false,
        IS_DELETED: false,
        OA_ID: domain.OA_ID,
        OA_BRAND_ID: brandId,
        TPIN: Number(input.tPin),
        MEMORABLE_WORD: input.memorableWord,
        USER_TYP_ID: input.userTypeId ?? null,
        PASSWORD_CHANGED_TIME: now,
        CONCURRENT_LOGIN_COUNT: 0,
        SUSPENSION_FAILED_LOGIN_ATTEMPTS: 0,
        FAILED_LOGIN_ATTEMPTS: 0,
        QUESTION_ONE: 0,
        QUESTION_TWO: 0,
        QUESTION_THREE: 0,
        ANSWER_ONE: '',
        ANSWER_TWO: '',
        ANSWER_THREE: '',
        NOTIFY_COUNT: 0,
        ACC_GROUP: 0,
        SUB_ACC_GROUP: 0,
        CREATED_BY: actor,
        CREATED_ON: now,
        UPDATED_BY: actor,
        UPDATED_ON: now,
      },
      select: { USER_ID: true },
    });
    const id = user.USER_ID;
    if (input.isAdmin) await tx.$executeRaw(setAdminFlagSql(id, true));

    await tx.user_password_history.create({
      data: {
        USER_ID: id,
        PASSWORD: hash,
        OA_ID: domain.OA_ID,
        OA_BRAND_ID: brandId,
        CREATED_BY: actor,
        UPDATED_BY: actor,
        CREATED_ON: now,
        UPDATED_ON: now,
      },
    });

    // emp_mst: Prisma marks TERMINATION_DATE etc. NOT NULL although every existing row has NULL
    // there, so the CI row is inserted with raw SQL (NOT NULL-in-Prisma text/id columns get the
    // same ''/0 values existing rows carry; the employee code is generated elsewhere — not ported).
    await tx.$executeRaw`
      INSERT INTO "emp_mst" ("REF_EMP_ID", "USER_ID", "EMP_NAME", "EMP_STATUS_ID", "OA_ID", "OA_BRAND_ID",
        "EMP_NBR", "COUNTRY_CODE", "EMP_OTHER_ID", "JOB_TITLE_ID", "EMP_GRADE_ID", "TERMINATION_ID",
        "IS_DELETED", "CREATED_BY", "CREATED_ON")
      VALUES (${id}, ${id}, ${input.userName}, ${empStatusId}, ${domain.OA_ID}, ${brandId},
        '', '', '', 0, 0, 0, 0, ${actor}, ${now})`;

    await tx.user_role.createMany({
      data: input.roleIds.map((roleId) => ({
        ROLE_ID: roleId,
        USER_ID: id,
        OA_ID: domain.OA_ID,
        OA_BRAND_ID: brandId,
        IS_DELETED: 0,
        CREATED_BY: actor,
        CREATED_ON: now,
      })),
    });

    await tx.permission_dtl.create({
      data: {
        PERMISSIONS_CLASS_ID: permissionClassId,
        PERMISSIONS_REF_TYPE_ID: PERMISSION_REF_TYPE_USER,
        PERMISSIONS_REF_ID: id,
        OA_ID: domain.OA_ID,
        OA_BRAND_ID: brandId,
        USER_ID: id,
        CREATED_BY: actor,
        CREATED_ON: now,
      },
    });
    return id;
  });

  return resource.get(subject, String(userId));
}

// ---------------------------------------------------------------- update

async function update(subject: RequestSubject, rawId: string, body: unknown): Promise<UserMasterDto> {
  await authorize(subject, 'update');
  const id = parseId(rawId);
  const existing = await resource.get(subject, String(id)); // scope + existence (404 outside scope)
  const input: UserMasterUpdateInput = userMasterUpdateSchema.parse(body);
  if (subject.adminLevel < 2 && existing.isSysAdmin) throw new ForbiddenError();

  const sameRoles =
    input.roleIds.length === existing.roleIds.length && input.roleIds.every((r) => existing.roleIds.includes(r));
  if (subject.adminLevel === 0) {
    // A plain user may edit their own details but not their domain, admin flag or roles.
    if (input.domainId !== existing.domainId || input.isAdmin !== existing.isAdmin || !sameRoles) {
      throw new ForbiddenError('Only an administrator can change the domain, administrator flag or roles.');
    }
  }

  const domain = await findDomainInScope(subject, input.domainId, 'org');
  const brandId = domain.OA_BRAND_ID;
  const nameChanged = input.userName.toLowerCase() !== existing.userName.toLowerCase();

  const errors: FieldErrors = {
    // Brand username rules only apply to a new name (legacy names may predate the policy).
    userName: [
      ...(nameChanged ? await validateUsernameRules(input.userName, brandId, { exceptUserId: id }) : []),
      ...(nameChanged || domain.DMN_ID !== existing.domainId ? await userDomainComboErrors(input.userName, domain.DMN_ID, id) : []),
    ],
    regEmail: await emailErrors(input.regEmail, id),
    roleIds: sameRoles && brandId === existing.oaBrandId ? [] : await roleErrors(input.roleIds, brandId),
    userTypeId: input.userTypeId === (existing.userTypeId ?? undefined) ? [] : await validateUserType(input.userTypeId),
  };
  throwIfErrors(errors);
  if (input.password) {
    await assertPasswordAllowed(input.password, { userId: id, oaBrandId: brandId }, 'password');
    await assertInsertSafe('user_password_history', 'ID');
  }

  const current = await prisma.user_role.findMany({
    where: { USER_ID: id, IS_DELETED: 0 },
    select: { USER_ROLE_ID: true, ROLE_ID: true },
  });
  const wanted = new Set(input.roleIds);
  const removed = current.filter((r) => !wanted.has(r.ROLE_ID)).map((r) => r.USER_ROLE_ID);
  const kept = new Set(current.map((r) => r.ROLE_ID));
  const added = input.roleIds.filter((r) => !kept.has(r));
  if (added.length) await assertInsertSafe('user_role', 'USER_ROLE_ID');

  const now = new Date();
  const actor = subject.userId;
  await prisma.$transaction(async (tx) => {
    await tx.user_mst.updateMany({
      where: { USER_ID: id },
      data: {
        USER_NAME: input.userName,
        REG_EMAIL_ID: input.regEmail,
        EXT_REF_NBR: input.extRefId,
        DMN_ID: domain.DMN_ID,
        OA_ID: domain.OA_ID,
        OA_BRAND_ID: brandId,
        USER_TYP_ID: input.userTypeId ?? null,
        ...(input.tPin ? { TPIN: Number(input.tPin) } : {}),
        ...(input.memorableWord ? { MEMORABLE_WORD: input.memorableWord } : {}),
        ...(input.activate ? { ACTIVATION: null } : {}),
        UPDATED_BY: actor,
        UPDATED_ON: now,
      },
    });
    if (subject.adminLevel >= 1 && input.isAdmin !== existing.isAdmin) await tx.$executeRaw(setAdminFlagSql(id, input.isAdmin));
    if (removed.length) {
      await tx.user_role.updateMany({
        where: { USER_ROLE_ID: { in: removed }, USER_ID: id },
        data: { IS_DELETED: 1, UPDATED_BY: actor, UPDATED_ON: now },
      });
    }
    if (added.length) {
      await tx.user_role.createMany({
        data: added.map((roleId) => ({
          ROLE_ID: roleId,
          USER_ID: id,
          OA_ID: domain.OA_ID,
          OA_BRAND_ID: brandId,
          IS_DELETED: 0,
          CREATED_BY: actor,
          CREATED_ON: now,
        })),
      });
    }
  });

  // Separate transaction owned by the shared password service (history + status Active).
  if (input.password) await setUserPassword(id, input.password, { actorId: actor });

  return resource.get(subject, String(id));
}

// ---------------------------------------------------------------- status actions

/**
 * CI user_change_status/{USA|USD} and user_suspend_status (admin only, bulk).
 *  activate            → USA, failed-attempt counters 0, ACTIVATION cleared
 *  deactivate          → USD
 *  activate-suspended  → LAST_LOGIN_AT = now AND status USA (CI only reset LAST_LOGIN_AT, so a
 *                        suspended user stayed suspended)
 */
async function changeStatus(subject: RequestSubject, body: unknown) {
  await authorize(subject, 'update');
  if (subject.adminLevel < 1) throw new ForbiddenError();
  const { action, ids } = userStatusActionSchema.parse(body);

  const scope = tenantWhere(subject, 'org');
  const targets = await prisma.user_mst.findMany({
    where: { USER_ID: { in: ids }, ...ACTIVE_BOOL, ...scope },
    select: { USER_ID: true, IS_SYSADMIN: true, IS_ADMIN: true, ACTIVATION: true, USER_STATUS_ID: true },
  });
  if (targets.length !== ids.length) throw new NotFoundError('One or more users were not found.');
  if (subject.adminLevel < 2 && targets.some((t) => isSysAdminRow(t))) throw new ForbiddenError();
  if (action === 'deactivate' && ids.includes(subject.userId)) {
    throw new BusinessRuleError('You cannot deactivate your own account.', 'SELF');
  }

  const now = new Date();
  const activeId = await userStatusId(USER_STATUS.ACTIVE);
  const alreadyActive = targets.filter((t) => t.USER_STATUS_ID === activeId && !t.ACTIVATION).length;
  const where = { USER_ID: { in: ids }, ...scope };
  const audit = { UPDATED_BY: subject.userId, UPDATED_ON: now };

  let data: Prisma.user_mstUpdateManyMutationInput;
  if (action === 'deactivate') {
    data = { USER_STATUS_ID: await userStatusId(USER_STATUS.DEACTIVATED), ...audit };
  } else if (action === 'activate') {
    data = { USER_STATUS_ID: activeId, FAILED_LOGIN_ATTEMPTS: 0, SUSPENSION_FAILED_LOGIN_ATTEMPTS: 0, ACTIVATION: null, ...audit };
  } else {
    data = { USER_STATUS_ID: activeId, LAST_LOGIN_AT: now, ...audit };
  }
  const result = await prisma.user_mst.updateMany({ where, data });

  const message =
    action === 'deactivate'
      ? 'Successfully Deactivated User(s)'
      : action === 'activate-suspended'
        ? 'Activated Suspended User(s)'
        : alreadyActive === ids.length
          ? 'User(s) are already Activated'
          : 'Successfully Activated User(s)';
  return { count: result.count, message };
}

/** Target of a per-user action (send reset mail): exists, in scope, not a sysadmin for non-sysadmins. */
async function assertActionTarget(subject: RequestSubject, rawId: string): Promise<UserMasterDto> {
  await authorize(subject, 'update');
  const user = await resource.get(subject, rawId);
  if (subject.adminLevel < 2 && user.isSysAdmin && user.id !== subject.userId) throw new ForbiddenError();
  return user;
}

async function capabilities(subject: RequestSubject) {
  const [canUpdate, canCreate] = await Promise.all([policy.check(subject, 'update'), policy.check(subject, 'create')]);
  return {
    adminLevel: subject.adminLevel,
    userId: subject.userId,
    canCreate,
    canUpdate,
    canChangeStatus: canUpdate && subject.adminLevel >= 1,
    canSetAdmin: subject.adminLevel >= 1,
  };
}

export const userMasterService = {
  list: (subject: RequestSubject, query: Record<string, string>) => resource.list(subject, query),
  /** Create/update are custom (not ResourceService schemas), so the policy is asked directly. */
  async permissions(subject: RequestSubject) {
    const [create, update, del] = await Promise.all([
      policy.check(subject, 'create'),
      policy.check(subject, 'update'),
      policy.check(subject, 'delete'),
    ]);
    return { create, update, delete: del };
  },
  get: (subject: RequestSubject, id: string) => resource.get(subject, id),
  remove: (subject: RequestSubject, id: string) => resource.remove(subject, id),
  create,
  update,
  changeStatus,
  assertActionTarget,
  capabilities,
};
