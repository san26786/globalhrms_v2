import { prisma } from '@/lib/prisma';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { BusinessRuleError, ForbiddenError, NotFoundError, ServiceUnavailableError, ValidationError } from '@/lib/http/errors';
import { getMasterId, getMasterText } from '@/lib/masters/masterService';
import { loadMasterType } from '@/lib/common/masterData.service';
import { menuPolicy } from '@/lib/resource/policies';
import type { ResourceAction } from '@/lib/resource';
import { settingService, toNumber } from '@/lib/settings/settingService';
import { permissionClassSaveSchema, type PermissionClassSaveInput } from '@/validations/permissionClass.schema';
import { PERMISSION_CLASS_TYPE_ID, permissionClassRepository as repo } from './permissionClass.repository';
import type { IdOption, OrgRefOptions, PermissionClassInit, RefTypeIds } from './types';

/**
 * Permission Class — port of CI user/permission_dtl (newPermissionDtl / editPermissionDtl /
 * insert → setFormControls, the controller the list's Add/Edit actually call) and
 * user/permission_class (delete, sync_permissions). Differences from CI are marked "CI:".
 */

const policy = menuPolicy('user/permission_class');

const DENIED: Record<'create' | 'update' | 'delete', { code: string; fallback: string }> = {
  create: { code: 'EMTSI00001', fallback: 'You do not have permission to add permission classes.' },
  update: { code: 'EMTSI00002', fallback: 'You do not have permission to modify permission classes.' },
  delete: { code: 'EMTSI00003', fallback: 'You do not have permission to delete permission classes.' },
};

async function authorize(subject: RequestSubject, action: ResourceAction): Promise<void> {
  if (await policy.check(subject, action)) return;
  const denied = action === 'create' || action === 'update' || action === 'delete' ? DENIED[action] : null;
  throw new ForbiddenError(denied ? await getMasterText(denied.code, denied.fallback) : undefined);
}

/** CI hidden inputs userTab / userGroupTab / roleTab / functionTab (MSTR_IDs of PRTUP / PRTGP / PRTRP / FUNP). */
async function refTypeIds(): Promise<RefTypeIds> {
  const [user, userGroup, role, fn] = await Promise.all([
    getMasterId('PRTUP'),
    getMasterId('PRTGP'),
    getMasterId('PRTRP'),
    getMasterId('FUNP'),
  ]);
  if (!user || !userGroup || !role || !fn) {
    throw new ServiceUnavailableError('Permission reference types (PRTUP / PRTGP / PRTRP / FUNP) are not configured.');
  }
  return { user, userGroup, role, function: fn };
}

/**
 * CI getSettingAttributeValue('SSABAN', brand): the brand's application id, 0 when unset. (The
 * session's brandApplicationID defaulted to 370 instead, but these screens read the raw value —
 * predefined classes carry APP_ID 0, so 370 would match none of them.)
 */
async function brandAppId(oaBrandId: number): Promise<number> {
  return toNumber(await settingService.getValue('SSABAN', oaBrandId));
}

function parseId(raw: string | number | null | undefined, label: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new ValidationError('Invalid id.', { [label]: ['Must be a positive integer.'] });
  return id;
}

interface Tenant {
  oaId: number | null;
  oaBrandId: number | null;
  userId: number | null;
}

/**
 * CI OrgDetailsView + permission_dtl_m::insert / insertFunc:
 *   is_admin 0 → session org / brand / user (all three fields hidden);
 *   is_admin 1 → session org / brand (hidden), "Requested By" posted;
 *   is_admin 2 → Merchant Account, Brand and Requested By posted.
 * CI trusted the posted ids; here they must be consistent: the brand of that organisation and a
 * user of that brand (the "Requested By" list is the brand's users).
 */
async function resolveTenant(subject: RequestSubject, input: PermissionClassSaveInput): Promise<Tenant> {
  if (subject.adminLevel === 0) return { oaId: subject.oaId, oaBrandId: subject.oaBrandId, userId: subject.userId };

  const sysAdmin = subject.adminLevel === 2;
  const oaId = sysAdmin ? input.oaId ?? null : subject.oaId;
  const oaBrandId = sysAdmin ? input.oaBrandId ?? null : subject.oaBrandId;
  const userId = input.userId ?? null;

  const errors: Record<string, string[]> = {};
  if (!oaId) errors.oaId = ['The Merchant Account field is required.'];
  if (!oaBrandId) errors.oaBrandId = ['The Brand field is required.'];
  if (!userId) errors.userId = ['Please select Requested By'];
  if (Object.keys(errors).length) throw new ValidationError('Validation failed.', errors);

  const [brand, user] = await Promise.all([
    prisma.oa_brands.findFirst({ where: { OA_BRAND_ID: oaBrandId as number, OA_ID: oaId as number, IS_DELETED: 0 }, select: { OA_BRAND_ID: true } }),
    prisma.user_mst.findFirst({
      where: { USER_ID: userId as number, OA_BRAND_ID: oaBrandId as number, OR: [{ IS_DELETED: false }, { IS_DELETED: null }] },
      select: { USER_ID: true },
    }),
  ]);
  if (!brand) throw new ValidationError('Validation failed.', { oaBrandId: ['Select a brand of the chosen merchant account.'] });
  if (!user) throw new ValidationError('Validation failed.', { userId: ['Select a user of the chosen brand.'] });
  return { oaId, oaBrandId, userId };
}

/** Only ids the org offers may be granted (CI accepted any posted id). */
function assertAllowed(ids: number[], options: IdOption[], field: string, label: string) {
  const allowed = new Set(options.map((o) => o.value));
  const bad = ids.filter((id) => !allowed.has(id));
  if (bad.length) throw new ValidationError('Validation failed.', { [field]: [`Unknown ${label}: ${bad.slice(0, 5).join(', ')}.`] });
}

const bit = (v: boolean) => (v ? 1 : 0);

export const permissionClassService = {
  /** CI initForm($id, $classID): everything the add / edit form needs, in one response. */
  async init(subject: RequestSubject, rawClassId?: string | null): Promise<PermissionClassInit> {
    await authorize(subject, 'list');
    const classId = rawClassId ? parseId(rawClassId, 'classId') : null;
    const brandId = subject.oaBrandId;
    const cls = classId ? await repo.findClass(classId) : null;
    if (classId && !cls) throw new NotFoundError('Permission class not found.');

    const refTypes = await refTypeIds();
    // CI (permission_dtl::initForm): org / brand always from the session; the user ("Requested By")
    // from the class's first row in this brand.
    const userId = classId && brandId ? (await repo.classUserId(classId, brandId)) ?? subject.userId : subject.userId;

    const [options, modules, refSel, functions, accessOptions, accessSel, requestedByUsers] = await Promise.all([
      subject.oaId ? repo.orgRefOptions(subject.oaId) : Promise.resolve<OrgRefOptions>({ users: [], userGroups: [], roles: [] }),
      repo.functionTree({ isSysAdmin: subject.adminLevel === 2, oaBrandId: brandId, appId: brandId ? await brandAppId(brandId) : 0 }),
      classId && brandId ? repo.refSelections(classId, brandId, [refTypes.user, refTypes.userGroup, refTypes.role]) : Promise.resolve(new Map<number, number[]>()),
      classId && brandId ? repo.functionGrants(classId, brandId, refTypes.function) : Promise.resolve({}),
      repo.accessOptions(),
      classId && brandId ? repo.accessSelections(classId, brandId) : Promise.resolve<number[]>([]),
      brandId ? repo.brandUsers(brandId) : Promise.resolve<IdOption[]>([]),
    ]);

    return {
      mode: classId ? 'edit' : 'add',
      title: classId ? 'Edit Permission Details' : 'New Permission Details',
      adminLevel: subject.adminLevel,
      classId,
      className: cls?.name ?? '',
      oaId: subject.oaId,
      oaBrandId: brandId,
      userId,
      refTypes,
      accessOptions,
      requestedByUsers,
      modules,
      ...options,
      selection: {
        accessPermissions: accessSel,
        users: refSel.get(refTypes.user) ?? [],
        userGroups: refSel.get(refTypes.userGroup) ?? [],
        roles: refSel.get(refTypes.role) ?? [],
        functions,
      },
    };
  },

  /** CI smartSearchPermissionClass: {label, value} suggestions for the class name. */
  async search(subject: RequestSubject, q: string): Promise<IdOption[]> {
    await authorize(subject, 'list');
    return repo.searchClasses(q.trim().slice(0, 100));
  },

  /** CI getUserListForOaId($OaId): users / roles / groups of an organisation (super admin only, as in CI). */
  async orgOptions(subject: RequestSubject, rawOaId: string): Promise<OrgRefOptions> {
    await authorize(subject, 'list');
    const oaId = parseId(rawOaId, 'oaId');
    if (subject.adminLevel !== 2 && oaId !== subject.oaId) throw new ForbiddenError('You can only view your own organisation.');
    return repo.orgRefOptions(oaId);
  },

  /** CI dependableUserBasedOnOrgBrand($brand): "Requested By" users when a super admin changes brand. */
  async brandUsers(subject: RequestSubject, rawBrandId: string): Promise<IdOption[]> {
    await authorize(subject, 'list');
    const brandId = parseId(rawBrandId, 'oaBrandId');
    if (subject.adminLevel !== 2 && brandId !== subject.oaBrandId) throw new ForbiddenError('You can only view your own brand.');
    return repo.brandUsers(brandId);
  },

  /**
   * CI setFormControls (insert path, used for add AND edit): resolve / create the class master,
   * delete the class's rows when it already exists, then insert one row per user, group, role and
   * function — in ONE transaction (CI had none).
   */
  async save(subject: RequestSubject, body: unknown): Promise<{ classId: number; message: string }> {
    const input = permissionClassSaveSchema.parse(body);
    const postedId = input.permissionClassId ?? null;
    await authorize(subject, postedId ? 'update' : 'create');

    const tenant = await resolveTenant(subject, input);
    const refTypes = await refTypeIds();

    // Only ids the organisation / tree offers may be granted.
    if (tenant.oaId) {
      const opts = await repo.orgRefOptions(tenant.oaId);
      assertAllowed(input.users, opts.users, 'users', 'user');
      assertAllowed(input.userGroups, opts.userGroups, 'userGroups', 'user group');
      assertAllowed(input.roles, opts.roles, 'roles', 'role');
    }
    assertAllowed(input.accessPermissions, await repo.accessOptions(), 'accessPermissions', 'access permission');
    const tree = await repo.functionTree({
      isSysAdmin: subject.adminLevel === 2,
      oaBrandId: tenant.oaBrandId,
      appId: tenant.oaBrandId ? await brandAppId(tenant.oaBrandId) : 0,
    });
    const treeIds = new Set(tree.flatMap((m) => [m.relDetId, ...m.children.map((c) => c.relDetId)]));
    const unknownFn = input.functions.filter((f) => !treeIds.has(f.relDetId)).map((f) => f.relDetId);
    if (unknownFn.length) throw new ValidationError('Validation failed.', { functions: [`Unknown functions: ${unknownFn.slice(0, 5).join(', ')}.`] });

    let classId: number | null = postedId;
    if (postedId && !(await repo.findClass(postedId))) throw new NotFoundError('Permission class not found.');

    const type = await loadMasterType(PERMISSION_CLASS_TYPE_ID);
    if (!classId) {
      // CI permission_class::setFormControls checkMasterName(name, PERMISSIONCLASS, brand). Permission
      // class is a SYSTEM type, so its masters carry no brand and this never matches — exactly like
      // the live permission_dtl controller, which always created a new master here.
      const existing = await prisma.independent_mst.findFirst({
        where: {
          MSTR_NM: input.permissionClassName,
          TYP_ID: PERMISSION_CLASS_TYPE_ID,
          OA_BRAND_ID: tenant.oaBrandId,
          OR: [{ IS_DELETED: false }, { IS_DELETED: null }],
        },
        select: { MSTR_ID: true },
        orderBy: { MSTR_ID: 'asc' },
      });
      classId = existing?.MSTR_ID ?? null;
    }
    const isExisting = classId !== null;

    await assertInsertSafe('permission_dtl', 'PERMISSIONS_DTL_ID');
    if (!isExisting) await assertInsertSafe('independent_mst', 'MSTR_ID');

    const now = new Date();
    const base = {
      OA_ID: tenant.oaId,
      OA_BRAND_ID: tenant.oaBrandId,
      USER_ID: tenant.userId,
      CREATED_BY: subject.userId,
      CREATED_ON: now,
      IS_DELETED: 0,
    };

    const savedId = await prisma.$transaction(async (tx) => {
      let id = classId;
      if (id === null) {
        // CI insertIndpMstData(null, name, null, PERMISSIONCLASS, 1, oa, brand, user): a SYSTEM type
        // is stored without org / brand / user.
        const system = type?.isSystem ?? true;
        const created = await tx.independent_mst.create({
          data: {
            MSTR_CD: null,
            MSTR_NM: input.permissionClassName,
            MSTR_DESC: null,
            TYP_ID: PERMISSION_CLASS_TYPE_ID,
            PARENT_MSTR_ID: 0,
            IS_EDITABLE: true,
            OA_ID: system ? null : tenant.oaId,
            OA_BRAND_ID: system ? null : tenant.oaBrandId,
            USER_ID: system ? null : tenant.userId,
            IS_DELETED: false,
            CREATED_BY: subject.userId,
            CREATED_ON: now,
          },
          select: { MSTR_ID: true },
        });
        id = created.MSTR_ID;
      } else {
        // CI deletePermissionClass($class): its rows in one brand. CI used the SESSION brand while
        // inserting with the posted brand (a super admin editing another brand duplicated rows);
        // here the brand being written is cleared.
        await tx.permission_dtl.deleteMany({ where: { PERMISSIONS_CLASS_ID: id, OA_BRAND_ID: tenant.oaBrandId } });
      }

      const refRows = (refTypeId: number, ids: number[]) =>
        ids.map((refId) => ({ ...base, PERMISSIONS_CLASS_ID: id, PERMISSIONS_REF_TYPE_ID: refTypeId, PERMISSIONS_REF_ID: refId }));
      const data = [
        // CI insert($class, $permissions, null, null, …) — "Access Write": a row with no ref type and
        // PERMISSIONS_ID = the access master. (CI inserted each of these TWICE: once in insert()'s
        // else-branch and again in its trailing if (!empty($Permissions)) block; written once here.)
        ...input.accessPermissions.map((permissionId) => ({
          ...base,
          PERMISSIONS_CLASS_ID: id,
          PERMISSIONS_REF_TYPE_ID: null,
          PERMISSIONS_REF_ID: null,
          PERMISSIONS_ID: permissionId,
        })),
        ...refRows(refTypes.user, input.users),
        ...refRows(refTypes.userGroup, input.userGroups),
        ...refRows(refTypes.role, input.roles),
        // CI insertFunc: one row per posted module id with its flags; Print / Execute are not on the form (0).
        ...[...new Map(input.functions.map((f) => [f.relDetId, f])).values()].map((f) => ({
          ...base,
          PERMISSIONS_CLASS_ID: id,
          PERMISSIONS_REF_TYPE_ID: refTypes.function,
          PERMISSIONS_REF_ID: f.relDetId,
          PERMISSION_ENABLED: bit(f.enabled),
          PERMISSION_READ_ONLY: bit(f.readonly),
          PERMISSION_MODIFY: bit(f.modify),
          PERMISSION_DELETE: bit(f.delete),
          PERMISSION_INSERT: bit(f.insert),
          PERMISSION_PRINT: 0,
          PERMISSION_EXECUTE: 0,
        })),
      ];
      if (data.length) await tx.permission_dtl.createMany({ data });
      return id as number;
    });

    // CI cleared its query cache (user+permission_dtl, user+permission_class, dashboard+dashboard).
    // Nothing here is cached across requests: lists and menus are read per request.
    return {
      classId: savedId,
      message: postedId ? 'Successfully Updated Profile Class' : 'Successfully Added Permissions Details',
    };
  },

  /** CI permission_class::delete($pid) → deletePermissionClass: the class's rows in the session brand. */
  async remove(subject: RequestSubject, rawId: string): Promise<{ id: number; deleted: number; message: string }> {
    await authorize(subject, 'delete');
    const id = parseId(rawId, 'id');
    if (!subject.oaBrandId) throw new BusinessRuleError('Your session has no active brand.', 'NO_ACTIVE_BRAND');
    const result = await prisma.permission_dtl.deleteMany({ where: { PERMISSIONS_CLASS_ID: id, OA_BRAND_ID: subject.oaBrandId } });
    return { id, deleted: result.count, message: `Successfully Deleted Permissions Detail ${id}` };
  },

  /**
   * CI permission_class::sync_permissions (brand admins only): replace the brand's permission
   * rows with the application's default access configuration. CI built the SQL by string
   * interpolation without a transaction; here it is parameterised and atomic, and it refuses to
   * run when no default configuration matches (CI would have deleted every row and inserted none).
   */
  async sync(subject: RequestSubject): Promise<{ inserted: number; message: string }> {
    if (subject.adminLevel !== 1) throw new ForbiddenError('Only brand administrators can sync permissions.');
    await authorize(subject, 'update');
    const brandId = subject.oaBrandId;
    if (!brandId) throw new BusinessRuleError('Your session has no active brand.', 'NO_ACTIVE_BRAND');
    const appId = await brandAppId(brandId);

    // independent_mst_vw (TYP_CD = 'PC') was not migrated: TYP_CD comes from common_type.
    const classes = await prisma.$queryRaw<Array<{ MSTR_ID: number; MSTR_CD: string }>>`
      SELECT DISTINCT im."MSTR_ID", im."MSTR_CD"
      FROM independent_mst im
      WHERE im."MSTR_CD" IS NOT NULL
        AND im."APP_ID" = ${appId}
        AND im."TYP_ID" IN (SELECT ct."TYP_ID" FROM common_type ct WHERE ct."TYP_CD" = 'PC')
      ORDER BY im."MSTR_ID"`;
    const classIds = classes.map((c) => c.MSTR_ID);
    const defaults = classIds.length
      ? await prisma.default_access_confug.count({ where: { PERMISSIONS_CLASS_ID: { in: classIds } } })
      : 0;
    if (defaults === 0) {
      throw new BusinessRuleError(
        `No default access configuration exists for this brand's application (${appId}); nothing was changed.`,
        'NO_DEFAULT_ACCESS',
      );
    }

    const refTypes = await refTypeIds();
    await assertInsertSafe('permission_dtl', 'PERMISSIONS_DTL_ID');
    const now = new Date();
    const inserted = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`DELETE FROM permission_dtl WHERE "OA_BRAND_ID" = ${brandId}`;
      const copied = await tx.$executeRaw`
        INSERT INTO permission_dtl ("PERMISSIONS_CLASS_ID", "PERMISSIONS_REF_TYPE_ID", "PERMISSIONS_REF_ID", "PERMISSIONS_ID",
          "PERMISSION_ENABLED", "PERMISSION_READ_ONLY", "PERMISSION_MODIFY", "PERMISSION_DELETE", "PERMISSION_PRINT",
          "PERMISSION_EXECUTE", "PERMISSION_INSERT", "OA_ID", "OA_BRAND_ID", "USER_ID", "CREATED_BY", "CREATED_ON")
        SELECT dac."PERMISSIONS_CLASS_ID", dac."PERMISSIONS_REF_TYPE_ID", dac."PERMISSIONS_REF_ID", dac."PERMISSIONS_ID",
          dac."PERMISSION_ENABLED", dac."PERMISSION_READ_ONLY", dac."PERMISSION_MODIFY", dac."PERMISSION_DELETE", dac."PERMISSION_PRINT",
          dac."PERMISSION_EXECUTE", dac."PERMISSION_INSERT", ${subject.oaId}, ${brandId}, ${subject.userId}, ${subject.userId}, ${now}
        FROM default_access_confug dac
        WHERE dac."PERMISSIONS_CLASS_ID" = ANY(${classIds}::int[])`;
      // CI: "Insert user id to fetch the menu" — one user-type row per class; PCBA gets the admin.
      await tx.permission_dtl.createMany({
        data: classes.map((c) => ({
          PERMISSIONS_CLASS_ID: c.MSTR_ID,
          PERMISSIONS_REF_TYPE_ID: refTypes.user, // CI: 65 (PRTUP)
          PERMISSIONS_REF_ID: c.MSTR_CD === 'PCBA' ? subject.userId : null,
          OA_ID: subject.oaId,
          OA_BRAND_ID: brandId,
          USER_ID: subject.userId,
          CREATED_BY: subject.userId,
          CREATED_ON: now,
          IS_DELETED: 0,
        })),
      });
      return copied + classes.length;
    });

    return { inserted, message: `Permissions synced (${inserted} rows).` };
  },
};

/**
 * Permission Details (CI user/permission_dtl::index): the list's Delete Selected →
 * common_c::softDelete('permission_dtl', 'PERMISSIONS_DTL_ID', ids) — IS_DELETED = 1, after
 * has_delete_permission (EMTSI00003). CI soft-deleted any posted id; here only rows of the
 * caller's organisation (super admin: any), matching the list's ORG_ACC_ID scope.
 * Note: like CI, the menu and permission lookups do not filter IS_DELETED, so a soft-deleted
 * grant still applies until the class is saved again or deleted.
 */
const detailPolicy = menuPolicy('user/permission_dtl');

export const permissionDtlService = {
  async softDelete(subject: RequestSubject, rawId: string): Promise<{ id: number; message: string }> {
    if (!(await detailPolicy.check(subject, 'delete'))) {
      throw new ForbiddenError(await getMasterText(DENIED.delete.code, DENIED.delete.fallback));
    }
    const id = parseId(rawId, 'id');
    const result = await prisma.permission_dtl.updateMany({
      where: {
        PERMISSIONS_DTL_ID: id,
        ...(subject.adminLevel === 2 ? {} : { OA_ID: subject.oaId ?? -1 }),
        IS_DELETED: 0,
      },
      data: { IS_DELETED: 1, UPDATED_BY: subject.userId, UPDATED_ON: new Date() },
    });
    if (result.count === 0) throw new NotFoundError('Permission detail not found.');
    return { id, message: 'Successfully Deleted' };
  },
};
