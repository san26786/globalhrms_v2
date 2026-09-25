import { prisma } from '@/lib/prisma';
import { ConflictError, type FieldErrors } from '@/lib/http/errors';
import { ResourceService, menuPolicy, type ResourceDefinition } from '@/lib/resource';
import { userGroupRoleSchema, type UserGroupRoleInput } from '@/validations/user.schema';
import { ACTIVE_BOOL, adminWrites, createTargetBrand, intFilter, nameMaps, num, roleErrors, str, throwIfErrors } from './userScope';

/**
 * User Group Role — CI controllers/user/user_group_role.php (roles granted to a user group,
 * optionally for one group: index/{groupId}).
 *
 * Preserved: Role and User Group required; "User Group Role Already exits" for a duplicate
 * (group, role); list scoping sysadmin all / admin own organisation / user own rows; org, brand and
 * requested-by stamped from the session (sysadmin may choose the brand).
 * Fixed: group and role must belong to the brand the record is saved for (CI listed every brand's
 * groups and roles); the duplicate check ignores deleted rows and the edited row; CI hard-deleted →
 * soft delete (IS_DELETED = 1).
 */
export interface UserGroupRoleDto {
  id: number;
  groupId: number;
  groupName: string | null;
  roleId: number;
  roleName: string | null;
  oaBrandId: number;
  brandName: string | null;
}

async function validate(input: UserGroupRoleInput, brandId: number | null, exceptId?: number) {
  const group = await prisma.user_group.findFirst({
    where: { USER_GRP_ID: input.groupId, OA_BRAND_ID: brandId ?? -1, ...ACTIVE_BOOL },
    select: { USER_GRP_ID: true },
  });
  const errors: FieldErrors = {
    groupId: group ? [] : ['Select a user group of this brand.'],
    roleId: await roleErrors([input.roleId], brandId),
  };
  throwIfErrors(errors);
  const clash = await prisma.user_group_role.findFirst({
    where: {
      USER_GRP_ID: input.groupId,
      ROLE_ID: input.roleId,
      IS_DELETED: 0,
      ...(exceptId ? { NOT: { GRP_ROLE_ID: exceptId } } : {}),
    },
    select: { GRP_ROLE_ID: true },
  });
  if (clash) {
    const message = 'User Group Role Already exits';
    throw new ConflictError(message, { roleId: [message] });
  }
}

const toData = (i: UserGroupRoleInput) => ({ USER_GRP_ID: i.groupId, ROLE_ID: i.roleId });

const definition: ResourceDefinition<UserGroupRoleInput, UserGroupRoleInput, UserGroupRoleDto> = {
  label: 'User group role',
  model: 'user_group_role',
  primaryKey: 'GRP_ROLE_ID',
  sortFields: ['GRP_ROLE_ID', 'USER_GRP_ID', 'ROLE_ID'],
  defaultSort: { field: 'GRP_ROLE_ID', dir: 'desc' },
  filters: { groupId: { column: 'USER_GRP_ID', parse: intFilter } },
  tenancy: {
    mode: 'ci',
    scopeBy: 'org',
    orgColumn: 'OA_ID',
    brandColumn: 'OA_BRAND_ID',
    userColumn: 'USER_ID',
    sysAdminMayChooseBrand: true,
  },
  softDelete: { column: 'IS_DELETED', deleted: 1, active: 0 },
  audit: { createdBy: 'CREATED_BY', createdOn: 'CREATED_ON', updatedBy: 'UPDATED_BY', updatedOn: 'UPDATED_ON' },
  policy: adminWrites(menuPolicy('user/user_group_role')),
  createSchema: userGroupRoleSchema,
  updateSchema: userGroupRoleSchema,
  toCreateData: toData,
  toUpdateData: toData,
  hooks: {
    beforeCreate: (i, ctx) => validate(i, createTargetBrand(ctx.subject, i.oaBrandId)),
    beforeUpdate: (id, i, existing) => validate(i, num(existing.OA_BRAND_ID), id),
    async enrichRows(rows) {
      const names = await nameMaps(rows, { group: 'USER_GRP_ID', role: 'ROLE_ID', brand: 'OA_BRAND_ID' });
      return rows.map((r) => ({
        ...r,
        _group: names.group.get(r.USER_GRP_ID as number) ?? null,
        _role: names.role.get(r.ROLE_ID as number) ?? null,
        _brand: names.brand.get(r.OA_BRAND_ID as number) ?? null,
      }));
    },
  },
  toDto: (r) => ({
    id: r.GRP_ROLE_ID as number,
    groupId: r.USER_GRP_ID as number,
    groupName: str(r._group),
    roleId: r.ROLE_ID as number,
    roleName: str(r._role),
    oaBrandId: r.OA_BRAND_ID as number,
    brandName: str(r._brand),
  }),
};

export const userGroupRoleService = new ResourceService(definition);
