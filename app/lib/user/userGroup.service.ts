import { prisma } from '@/lib/prisma';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { ForbiddenError, type FieldErrors } from '@/lib/http/errors';
import { ResourceService, menuPolicy, type ResourceAction, type ResourceDefinition } from '@/lib/resource';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { userGroupSchema, type UserGroupInput } from '@/validations/user.schema';
import { ACTIVE_BOOL, findDomainInScope, memberErrors, nameMaps, str, throwIfErrors } from './userScope';

/**
 * User Group (+ User Group Detail members) — CI controllers/user/user_group.php,
 * user_group_dtl.php, models/user/user_group_m.php.
 *
 * Preserved: User Group name required; "Combination of User Group Name and Domain ID already
 * exists"; Domain required; "Select Users" (members, multi-select) required; members are kept in
 * user_group_dtl; edit diffs the members (removed → deleted, new → inserted); list scoping
 * sysadmin all / admin own organisation (ORG_ACC_ID) / user own rows (USERID); soft delete.
 * Fixed: the name/domain uniqueness is enforced on edit too (CI only on insert) and excludes the
 * edited group; org/brand come from the chosen domain (inside the caller's scope) instead of
 * posted ids; members must be users of that brand; member rows are written with org/brand and
 * audit columns (CI insertUser wrote only group + user); removed members are soft-deleted
 * (IS_DELETED = 1) instead of hard-deleted; the group is written together with its members in one
 * transaction.
 */
export interface UserGroupDto {
  id: number;
  name: string;
  domainId: number;
  domainName: string | null;
  oaBrandId: number;
  brandName: string | null;
  requestedBy: string | null;
  memberIds: number[];
  memberCount: number;
}

const policy = menuPolicy('user/user_group');

const definition: ResourceDefinition<never, never, UserGroupDto> = {
  label: 'User group',
  model: 'user_group',
  primaryKey: 'USER_GRP_ID',
  searchFields: ['USER_GRP_NM'],
  sortFields: ['USER_GRP_ID', 'USER_GRP_NM', 'DMN_ID', 'OA_BRAND_ID'],
  defaultSort: { field: 'USER_GRP_ID', dir: 'desc' },
  tenancy: { mode: 'ci', scopeBy: 'org', orgColumn: 'OA_ID', brandColumn: 'OA_BRAND_ID', ownerColumn: 'USER_ID' },
  softDelete: { column: 'IS_DELETED', deleted: true, active: false, nullIsActive: true },
  audit: { updatedBy: 'UPDATED_BY', updatedOn: 'UPDATED_ON' },
  policy,
  hooks: {
    async enrichRows(rows) {
      const ids = rows.map((r) => r.USER_GRP_ID as number);
      const [names, members] = await Promise.all([
        nameMaps(rows, { user: ['USER_ID'], domain: 'DMN_ID', brand: 'OA_BRAND_ID' }),
        prisma.user_group_dtl.findMany({
          where: { USER_GRP_ID: { in: ids }, IS_DELETED: 0 },
          select: { USER_GRP_ID: true, USER_ID: true },
        }),
      ]);
      const byGroup = new Map<number, Set<number>>();
      for (const m of members) byGroup.set(m.USER_GRP_ID, (byGroup.get(m.USER_GRP_ID) ?? new Set()).add(m.USER_ID));
      return rows.map((r) => ({
        ...r,
        _domain: names.domain.get(r.DMN_ID as number) ?? null,
        _brand: names.brand.get(r.OA_BRAND_ID as number) ?? null,
        _requestedBy: names.user.get(r.USER_ID as number) ?? null,
        _members: [...(byGroup.get(r.USER_GRP_ID as number) ?? [])],
      }));
    },
  },
  toDto: (r) => {
    const memberIds = (r._members as number[]) ?? [];
    return {
      id: r.USER_GRP_ID as number,
      name: (r.USER_GRP_NM as string) ?? '',
      domainId: r.DMN_ID as number,
      domainName: str(r._domain),
      oaBrandId: r.OA_BRAND_ID as number,
      brandName: str(r._brand),
      requestedBy: str(r._requestedBy),
      memberIds,
      memberCount: memberIds.length,
    };
  },
};

const resource = new ResourceService(definition);

async function authorize(subject: RequestSubject, action: ResourceAction) {
  if (!(await policy.check(subject, action))) throw new ForbiddenError();
}

async function nameErrors(name: string, domainId: number, exceptId?: number): Promise<string[]> {
  const clash = await prisma.user_group.findFirst({
    where: {
      USER_GRP_NM: { equals: name, mode: 'insensitive' },
      DMN_ID: domainId,
      ...ACTIVE_BOOL,
      ...(exceptId ? { NOT: { USER_GRP_ID: exceptId } } : {}),
    },
    select: { USER_GRP_ID: true },
  });
  return clash ? ['Combination of User Group Name and Domain ID already exists'] : [];
}

async function validate(subject: RequestSubject, input: UserGroupInput, exceptId?: number) {
  const domain = await findDomainInScope(subject, input.domainId, 'org');
  const errors: FieldErrors = {
    name: await nameErrors(input.name, domain.DMN_ID, exceptId),
    memberIds: await memberErrors(input.memberIds, domain.OA_BRAND_ID),
  };
  throwIfErrors(errors);
  return domain;
}

async function create(subject: RequestSubject, body: unknown): Promise<UserGroupDto> {
  await authorize(subject, 'create');
  const input = userGroupSchema.parse(body);
  const domain = await validate(subject, input);
  await assertInsertSafe('user_group', 'USER_GRP_ID');
  await assertInsertSafe('user_group_dtl', 'USER_GRP_DTL_ID');
  const now = new Date();
  const actor = subject.userId;
  const id = await prisma.$transaction(async (tx) => {
    const group = await tx.user_group.create({
      data: {
        USER_GRP_NM: input.name,
        DMN_ID: domain.DMN_ID,
        IS_DELETED: false,
        OA_ID: domain.OA_ID,
        OA_BRAND_ID: domain.OA_BRAND_ID,
        USER_ID: actor,
        CREATED_BY: actor,
        CREATED_ON: now,
        UPDATED_BY: actor,
        UPDATED_ON: now,
      },
      select: { USER_GRP_ID: true },
    });
    await tx.user_group_dtl.createMany({
      data: input.memberIds.map((userId) => ({
        USER_GRP_ID: group.USER_GRP_ID,
        USER_ID: userId,
        IS_DELETED: 0,
        OA_ID: domain.OA_ID,
        OA_BRAND_ID: domain.OA_BRAND_ID,
        CREATED_BY: actor,
        CREATED_ON: now,
      })),
    });
    return group.USER_GRP_ID;
  });
  return resource.get(subject, String(id));
}

async function update(subject: RequestSubject, rawId: string, body: unknown): Promise<UserGroupDto> {
  await authorize(subject, 'update');
  const existing = await resource.get(subject, rawId);
  const input = userGroupSchema.parse(body);
  const domain = await validate(subject, input, existing.id);

  const current = await prisma.user_group_dtl.findMany({
    where: { USER_GRP_ID: existing.id, IS_DELETED: 0 },
    select: { USER_GRP_DTL_ID: true, USER_ID: true },
  });
  const wanted = new Set(input.memberIds);
  const removed = current.filter((m) => !wanted.has(m.USER_ID)).map((m) => m.USER_GRP_DTL_ID);
  const kept = new Set(current.map((m) => m.USER_ID));
  const added = input.memberIds.filter((u) => !kept.has(u));
  if (added.length) await assertInsertSafe('user_group_dtl', 'USER_GRP_DTL_ID');

  const now = new Date();
  const actor = subject.userId;
  await prisma.$transaction(async (tx) => {
    await tx.user_group.updateMany({
      where: { USER_GRP_ID: existing.id },
      data: {
        USER_GRP_NM: input.name,
        DMN_ID: domain.DMN_ID,
        OA_ID: domain.OA_ID,
        OA_BRAND_ID: domain.OA_BRAND_ID,
        UPDATED_BY: actor,
        UPDATED_ON: now,
      },
    });
    if (removed.length) {
      await tx.user_group_dtl.updateMany({
        where: { USER_GRP_DTL_ID: { in: removed }, USER_GRP_ID: existing.id },
        data: { IS_DELETED: 1, UPDATED_BY: actor, UPDATED_ON: now },
      });
    }
    if (added.length) {
      await tx.user_group_dtl.createMany({
        data: added.map((userId) => ({
          USER_GRP_ID: existing.id,
          USER_ID: userId,
          IS_DELETED: 0,
          OA_ID: domain.OA_ID,
          OA_BRAND_ID: domain.OA_BRAND_ID,
          CREATED_BY: actor,
          CREATED_ON: now,
        })),
      });
    }
  });
  return resource.get(subject, rawId);
}

async function permissions(subject: RequestSubject) {
  const [c, u, d] = await Promise.all([policy.check(subject, 'create'), policy.check(subject, 'update'), policy.check(subject, 'delete')]);
  return { create: c, update: u, delete: d };
}

export const userGroupService = {
  list: (subject: RequestSubject, query: Record<string, string>) => resource.list(subject, query),
  permissions,
  get: (subject: RequestSubject, id: string) => resource.get(subject, id),
  remove: (subject: RequestSubject, id: string) => resource.remove(subject, id),
  create,
  update,
};

