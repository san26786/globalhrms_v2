import { prisma } from '@/lib/prisma';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/http/errors';
import { ResourceService, adminOnly, menuPolicy, type ResourceAction, type ResourceDefinition } from '@/lib/resource';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { userRoleSchema, type UserRoleInput } from '@/validations/user.schema';
import { ACTIVE_BOOL, adminWrites, fail, intFilter, nameMaps, roleErrors, str, tenantWhere } from './userScope';

/**
 * User Role — CI controllers/user/user_role.php (the "User Role" tab of a user: index/{userId}).
 *
 * Preserved: Role required; "Combination of User ID And Role ID already exists"; list of a user's
 * roles; admins manage, users see their own.
 * Fixed: CI stored the role for the "requested by" user of the org/brand selector and checked
 * uniqueness for that user → the role is added to the user of the tab; org/brand are the target
 * user's; the role must belong to that user's brand; uniqueness ignores deleted rows and the edited
 * row; CI hard-deleted → soft delete (IS_DELETED = 1).
 * Scope: admin → users of the own organisation (same scope as the User Master screen whose tab this
 * is; CI filtered this list by brand), user → own roles, sysadmin all.
 */
export interface UserRoleDto {
  id: number;
  userId: number;
  userName: string | null;
  roleId: number;
  roleName: string | null;
  oaBrandId: number;
  brandName: string | null;
}

const policy = adminWrites(menuPolicy('user/user_role', adminOnly));

const definition: ResourceDefinition<never, never, UserRoleDto> = {
  label: 'User role',
  model: 'user_role',
  primaryKey: 'USER_ROLE_ID',
  sortFields: ['USER_ROLE_ID', 'ROLE_ID', 'USER_ID'],
  defaultSort: { field: 'USER_ROLE_ID', dir: 'desc' },
  filters: { userId: { column: 'USER_ID', parse: intFilter } },
  tenancy: { mode: 'ci', scopeBy: 'org', orgColumn: 'OA_ID', brandColumn: 'OA_BRAND_ID', ownerColumn: 'USER_ID' },
  softDelete: { column: 'IS_DELETED', deleted: 1, active: 0 },
  audit: { updatedBy: 'UPDATED_BY', updatedOn: 'UPDATED_ON' },
  policy,
  hooks: {
    async beforeDelete(_id, existing, ctx) {
      if (ctx.subject.adminLevel === 2) return;
      const user = await prisma.user_mst.findFirst({
        where: { USER_ID: existing.USER_ID as number },
        select: { IS_SYSADMIN: true },
      });
      if (user?.IS_SYSADMIN) throw new ForbiddenError();
    },
    async enrichRows(rows) {
      const names = await nameMaps(rows, { user: ['USER_ID'], role: 'ROLE_ID', brand: 'OA_BRAND_ID' });
      return rows.map((r) => ({
        ...r,
        _user: names.user.get(r.USER_ID as number) ?? null,
        _role: names.role.get(r.ROLE_ID as number) ?? null,
        _brand: names.brand.get(r.OA_BRAND_ID as number) ?? null,
      }));
    },
  },
  toDto: (r) => ({
    id: r.USER_ROLE_ID as number,
    userId: r.USER_ID as number,
    userName: str(r._user),
    roleId: r.ROLE_ID as number,
    roleName: str(r._role),
    oaBrandId: r.OA_BRAND_ID as number,
    brandName: str(r._brand),
  }),
};

const resource = new ResourceService(definition);

async function authorize(subject: RequestSubject, action: ResourceAction) {
  if (!(await policy.check(subject, action))) throw new ForbiddenError();
}

/** The tab's user: non-deleted and inside the caller's scope. */
async function targetUser(subject: RequestSubject, userId: number) {
  const user = await prisma.user_mst.findFirst({
    where: { USER_ID: userId, ...ACTIVE_BOOL, ...tenantWhere(subject, 'org') },
    select: { USER_ID: true, OA_ID: true, OA_BRAND_ID: true, IS_SYSADMIN: true },
  });
  if (!user) fail('userId', 'User not found.');
  if (subject.adminLevel < 2 && user.IS_SYSADMIN) throw new ForbiddenError();
  return user;
}

async function validate(input: UserRoleInput, brandId: number | null, exceptId?: number) {
  const errors = await roleErrors([input.roleId], brandId);
  if (errors.length) throw new ValidationError(errors[0], { roleId: errors });
  const clash = await prisma.user_role.findFirst({
    where: {
      USER_ID: input.userId,
      ROLE_ID: input.roleId,
      IS_DELETED: 0,
      ...(exceptId ? { NOT: { USER_ROLE_ID: exceptId } } : {}),
    },
    select: { USER_ROLE_ID: true },
  });
  if (clash) {
    const message = 'Combination of User ID And Role ID already exists';
    throw new ConflictError(message, { roleId: [message] });
  }
}

async function create(subject: RequestSubject, body: unknown): Promise<UserRoleDto> {
  await authorize(subject, 'create');
  const input = userRoleSchema.parse(body);
  const user = await targetUser(subject, input.userId);
  await validate(input, user.OA_BRAND_ID);
  await assertInsertSafe('user_role', 'USER_ROLE_ID');
  const now = new Date();
  const row = await prisma.user_role.create({
    data: {
      ROLE_ID: input.roleId,
      USER_ID: user.USER_ID,
      OA_ID: user.OA_ID ?? 0,
      OA_BRAND_ID: user.OA_BRAND_ID ?? 0,
      IS_DELETED: 0,
      CREATED_BY: subject.userId,
      CREATED_ON: now,
      UPDATED_BY: subject.userId,
      UPDATED_ON: now,
    },
    select: { USER_ROLE_ID: true },
  });
  return resource.get(subject, String(row.USER_ROLE_ID));
}

async function update(subject: RequestSubject, rawId: string, body: unknown): Promise<UserRoleDto> {
  await authorize(subject, 'update');
  const existing = await resource.get(subject, rawId);
  const input = userRoleSchema.parse(body);
  if (input.userId !== existing.userId) fail('userId', 'The user of a role assignment cannot be changed.');
  const user = await targetUser(subject, existing.userId);
  await validate(input, user.OA_BRAND_ID, existing.id);
  const result = await prisma.user_role.updateMany({
    where: { USER_ROLE_ID: existing.id, IS_DELETED: 0 },
    data: { ROLE_ID: input.roleId, UPDATED_BY: subject.userId, UPDATED_ON: new Date() },
  });
  if (!result.count) throw new NotFoundError('User role not found.');
  return resource.get(subject, rawId);
}

async function permissions(subject: RequestSubject) {
  const [c, u, d] = await Promise.all([policy.check(subject, 'create'), policy.check(subject, 'update'), policy.check(subject, 'delete')]);
  return { create: c, update: u, delete: d };
}

export const userRoleService = {
  list: (subject: RequestSubject, query: Record<string, string>) => resource.list(subject, query),
  permissions,
  get: (subject: RequestSubject, id: string) => resource.get(subject, id),
  remove: (subject: RequestSubject, id: string) => resource.remove(subject, id),
  create,
  update,
};

