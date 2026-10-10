import { prisma } from '@/lib/prisma';
import { BusinessRuleError, ConflictError } from '@/lib/http/errors';
import { ResourceService, menuPolicy, type ResourceDefinition } from '@/lib/resource';
import { roleMasterSchema, type RoleMasterInput } from '@/validations/user.schema';
import { ACTIVE_BOOL, adminWrites, createTargetBrand, fail, intFilter, nameMaps, num, str } from './userScope';

/**
 * Role Master — CI controllers/user/role_master.php (list of role_mst_vw, optionally for one
 * domain: index/{domainId}).
 *
 * Preserved: Role Name required (max 40 = column size), Role Description required|max 50,
 * Authority Level required integer, Domain required; "Combination of Domain ID And Role Name
 * already exists"; IS_ADMIN_ROLE / IS_ASSIGNABLE checkboxes; soft delete.
 * Fixed: CI listed every brand's roles (no org filter) → scoped by brand (sysadmin all); the domain
 * must belong to the brand the role is saved for; IS_PREDEFINED is kept on edit (CI nulled it) and
 * predefined roles cannot be deleted; uniqueness excludes the edited record and deleted rows.
 * Not ported: syncDefaultRoleMst ("Sync Module") — it rewrites the brand's default roles in bulk.
 */
export interface RoleMasterDto {
  id: number;
  roleName: string;
  roleCode: string | null;
  description: string | null;
  authorityLevel: number | null;
  domainId: number | null;
  domainName: string | null;
  isAdminRole: boolean;
  isAssignable: boolean;
  isPredefined: boolean;
  oaBrandId: number;
  brandName: string | null;
}

async function validate(input: RoleMasterInput, brandId: number | null, exceptId?: number) {
  const domain = await prisma.user_domain.findFirst({
    where: { DMN_ID: input.domainId, OA_BRAND_ID: brandId ?? -1, ...ACTIVE_BOOL },
    select: { DMN_ID: true },
  });
  if (!domain) fail('domainId', 'Select a domain of this brand.');
  const clash = await prisma.role_mst.findFirst({
    where: {
      ROLE_NM: { equals: input.roleName, mode: 'insensitive' },
      DMN_ID: input.domainId,
      ...ACTIVE_BOOL,
      ...(exceptId ? { NOT: { ROLE_ID: exceptId } } : {}),
    },
    select: { ROLE_ID: true },
  });
  if (clash) {
    const message = 'Combination of Domain ID And Role Name already exists';
    throw new ConflictError(message, { roleName: [message] });
  }
}

const toData = (i: RoleMasterInput) => ({
  ROLE_NM: i.roleName,
  ROLE_DSCRPTN: i.description,
  AUTHORITY_LEVEL: i.authorityLevel,
  DMN_ID: i.domainId,
  IS_ADMIN_ROLE: i.isAdminRole,
  IS_ASSIGNABLE: i.isAssignable,
});

const definition: ResourceDefinition<RoleMasterInput, RoleMasterInput, RoleMasterDto> = {
  label: 'Role',
  model: 'role_mst',
  primaryKey: 'ROLE_ID',
  searchFields: ['ROLE_NM', 'ROLE_DSCRPTN', 'ROLE_CD'],
  sortFields: ['ROLE_ID', 'ROLE_NM', 'AUTHORITY_LEVEL', 'DMN_ID', 'OA_BRAND_ID'],
  defaultSort: { field: 'ROLE_ID', dir: 'desc' },
  filters: { domainId: { column: 'DMN_ID', parse: intFilter } },
  tenancy: {
    mode: 'brand',
    orgColumn: 'OA_ID',
    brandColumn: 'OA_BRAND_ID',
    userColumn: 'USER_ID',
    sysAdminMayChooseBrand: true,
  },
  softDelete: { column: 'IS_DELETED', deleted: true, active: false, nullIsActive: true },
  audit: { createdBy: 'CREATED_BY', createdOn: 'CREATED_ON', updatedBy: 'UPDATED_BY', updatedOn: 'UPDATED_ON' },
  policy: adminWrites(menuPolicy('user/role_master')),
  createSchema: roleMasterSchema,
  updateSchema: roleMasterSchema,
  toCreateData: (i) => ({ ...toData(i), IS_PREDEFINED: false }),
  toUpdateData: toData,
  hooks: {
    beforeCreate: (i, ctx) => validate(i, createTargetBrand(ctx.subject, i.oaBrandId)),
    beforeUpdate: (id, i, existing) => validate(i, num(existing.OA_BRAND_ID), id),
    async beforeDelete(_id, existing) {
      if (existing.IS_PREDEFINED === true) throw new BusinessRuleError('Cannot delete a predefined role.', 'PREDEFINED');
    },
    async enrichRows(rows) {
      const names = await nameMaps(rows, { domain: 'DMN_ID', brand: 'OA_BRAND_ID' });
      return rows.map((r) => ({
        ...r,
        _domain: names.domain.get(r.DMN_ID as number) ?? null,
        _brand: names.brand.get(r.OA_BRAND_ID as number) ?? null,
      }));
    },
  },
  toDto: (r) => ({
    id: r.ROLE_ID as number,
    roleName: (r.ROLE_NM as string) ?? '',
    roleCode: str(r.ROLE_CD),
    description: str(r.ROLE_DSCRPTN),
    authorityLevel: num(r.AUTHORITY_LEVEL),
    domainId: num(r.DMN_ID),
    domainName: str(r._domain),
    isAdminRole: r.IS_ADMIN_ROLE === true,
    isAssignable: r.IS_ASSIGNABLE !== false,
    isPredefined: r.IS_PREDEFINED === true,
    oaBrandId: r.OA_BRAND_ID as number,
    brandName: str(r._brand),
  }),
};

export const roleMasterService = new ResourceService(definition);
