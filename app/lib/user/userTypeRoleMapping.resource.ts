import { prisma } from '@/lib/prisma';
import { ConflictError } from '@/lib/http/errors';
import { ResourceService, sysAdminOnly, type ResourceDefinition } from '@/lib/resource';
import { getMasterOptionsByTypeCode, masterNames } from '@/lib/masters/masterService';
import { userTypeRoleMappingSchema, type UserTypeRoleMappingInput } from '@/validations/user.schema';
import { ACTIVE_BOOL, num, throwIfErrors } from './userScope';
import { APP_MASTER_TYPES } from './userOptions';

/**
 * User Type and Role Mapping — CI controllers/user/user_type_role_mapping.php (sysadmin only; the
 * CI header shows the entry to the system administrator only).
 *
 * Preserved: Application (masters of type code HTRHA) → dependent User Type (type 47), Role
 * (type 95) and Permission Class (type 49) filtered by APP_ID = application (CI getUserType /
 * getRole / getPermissionClass); all four required; soft delete.
 * Fixed: the *_CD columns (NOT NULL) are filled from the chosen masters (CI left them empty);
 * CREATED_BY/ON are written on insert (CI wrote only UPDATED_*); the dependent choices are
 * validated against the application server-side; the same (application, user type, role) cannot
 * be mapped twice.
 */
export const APPLICATION_TYPE_CODE = 'HTRHA';

export interface UserTypeRoleMappingDto {
  id: number;
  appId: number;
  appName: string | null;
  userTypeId: number;
  userTypeName: string | null;
  roleId: number;
  roleName: string | null;
  permissionClassId: number;
  permissionClassName: string | null;
}

async function toData(i: UserTypeRoleMappingInput) {
  const apps = await getMasterOptionsByTypeCode(APPLICATION_TYPE_CODE);
  const app = apps.find((a) => a.value === i.appId);
  const pick = (id: number, typeId: number) =>
    prisma.independent_mst.findFirst({
      where: { MSTR_ID: id, TYP_ID: typeId, APP_ID: i.appId, ...ACTIVE_BOOL },
      select: { MSTR_CD: true },
    });
  const [userType, role, permissionClass] = await Promise.all([
    pick(i.userTypeId, APP_MASTER_TYPES.userType),
    pick(i.roleId, APP_MASTER_TYPES.role),
    pick(i.permissionClassId, APP_MASTER_TYPES.permissionClass),
  ]);
  throwIfErrors({
    appId: app ? [] : ['Select a valid application.'],
    userTypeId: userType ? [] : ['Select a user type of this application.'],
    roleId: role ? [] : ['Select a role of this application.'],
    permissionClassId: permissionClass ? [] : ['Select a permission class of this application.'],
  });
  return {
    APP_ID: i.appId,
    APP_CD: (app?.code ?? '').slice(0, 10),
    USER_TYPE_ID: i.userTypeId,
    USER_TYPE_CD: (userType?.MSTR_CD ?? '').slice(0, 10),
    ROLE_ID: i.roleId,
    ROLE_CD: (role?.MSTR_CD ?? '').slice(0, 10),
    PERMISSION_CLASS_ID: i.permissionClassId,
    PERMISSION_CLASS_CD: (permissionClass?.MSTR_CD ?? '').slice(0, 10),
  };
}

async function assertUnique(i: UserTypeRoleMappingInput, exceptId?: number) {
  const clash = await prisma.user_type_role_mapping.findFirst({
    where: {
      APP_ID: i.appId,
      USER_TYPE_ID: i.userTypeId,
      ROLE_ID: i.roleId,
      IS_DELETED: false,
      ...(exceptId ? { NOT: { UTRM_ID: exceptId } } : {}),
    },
    select: { UTRM_ID: true },
  });
  if (clash) {
    const message = 'This application, user type and role are already mapped.';
    throw new ConflictError(message, { roleId: [message] });
  }
}

const definition: ResourceDefinition<UserTypeRoleMappingInput, UserTypeRoleMappingInput, UserTypeRoleMappingDto> = {
  label: 'User type role mapping',
  model: 'user_type_role_mapping',
  primaryKey: 'UTRM_ID',
  searchFields: ['USER_TYPE_CD', 'ROLE_CD', 'PERMISSION_CLASS_CD', 'APP_CD'],
  sortFields: ['UTRM_ID', 'APP_ID', 'USER_TYPE_ID', 'ROLE_ID', 'PERMISSION_CLASS_ID'],
  defaultSort: { field: 'UTRM_ID', dir: 'desc' },
  tenancy: { mode: 'none', orgColumn: 'OA_ID', brandColumn: 'OA_BRAND_ID', userColumn: 'USER_ID' },
  softDelete: { column: 'IS_DELETED', deleted: true, active: false },
  audit: { createdBy: 'CREATED_BY', createdOn: 'CREATED_ON', updatedBy: 'UPDATED_BY', updatedOn: 'UPDATED_ON' },
  policy: sysAdminOnly,
  createSchema: userTypeRoleMappingSchema,
  updateSchema: userTypeRoleMappingSchema,
  toCreateData: toData,
  toUpdateData: toData,
  hooks: {
    beforeCreate: (i) => assertUnique(i),
    beforeUpdate: (id, i) => assertUnique(i, id),
    async enrichRows(rows) {
      const names = await masterNames(
        rows.flatMap((r) => [r.APP_ID, r.USER_TYPE_ID, r.ROLE_ID, r.PERMISSION_CLASS_ID] as number[]),
      );
      const n = (v: unknown) => names.get(v as number)?.name ?? null;
      return rows.map((r) => ({
        ...r,
        _app: n(r.APP_ID),
        _userType: n(r.USER_TYPE_ID),
        _role: n(r.ROLE_ID),
        _class: n(r.PERMISSION_CLASS_ID),
      }));
    },
  },
  toDto: (r) => ({
    id: r.UTRM_ID as number,
    appId: r.APP_ID as number,
    appName: (r._app as string | null) ?? null,
    userTypeId: r.USER_TYPE_ID as number,
    userTypeName: (r._userType as string | null) ?? null,
    roleId: r.ROLE_ID as number,
    roleName: (r._role as string | null) ?? null,
    permissionClassId: r.PERMISSION_CLASS_ID as number,
    permissionClassName: (r._class as string | null) ?? null,
  }),
};

export const userTypeRoleMappingService = new ResourceService(definition);

/**
 * Permission class for a new user (CI user_master insert): the mapping of the chosen user type,
 * else a mapping keyed by one of the chosen roles (what CI looked up — note CI compared role_mst
 * ids with this table's ROLE_ID, which holds type-95 master ids, so it practically never matched),
 * else CI's hard-coded default class 1621.
 */
export const DEFAULT_PERMISSION_CLASS_ID = 1621;

export async function permissionClassForNewUser(userTypeId: number | undefined, roleIds: number[]): Promise<number> {
  const find = (where: { USER_TYPE_ID: number } | { ROLE_ID: { in: number[] } }) =>
    prisma.user_type_role_mapping.findFirst({
      where: { IS_DELETED: false, ...where },
      orderBy: [{ UTRM_ID: 'asc' }],
      select: { PERMISSION_CLASS_ID: true },
    });
  const mapping = (userTypeId ? await find({ USER_TYPE_ID: userTypeId }) : null) ?? (await find({ ROLE_ID: { in: roleIds } }));
  return num(mapping?.PERMISSION_CLASS_ID) ?? DEFAULT_PERMISSION_CLASS_ID;
}
