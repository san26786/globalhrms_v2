import { prisma } from '@/lib/prisma';
import { ResourceService, menuPolicy, type ResourceDefinition } from '@/lib/resource';
import { masterNames } from '@/lib/masters/masterService';
import { authorityLevelSchema, type AuthorityLevelInput } from '@/validations/user.schema';
import { fail, nameMaps, num, str } from './userScope';

/**
 * Authority Level — CI controllers/authoritylevel/authoritylevel.php (authority_level_vw).
 *
 * Preserved: Authority Level (masters of type 40) and Value required.
 * Fixed: CI listed every brand's rows (no filter) → scoped by brand (sysadmin all); CI's model
 * received (userId, oaId, brandId) in the order (oaId, brandId, userId) and wrote them to the wrong
 * columns → org / brand / requested-by are stamped from the session into the right columns
 * (a sysadmin may choose the brand); CI hard-deleted → soft delete.
 */
export const AUTHORITY_LEVEL_TYPE_ID = 40;

export interface AuthorityLevelDto {
  id: number;
  authorityLevelId: number | null;
  authorityLevelName: string | null;
  value: string | null;
  oaBrandId: number | null;
  brandName: string | null;
}

async function toData(i: AuthorityLevelInput) {
  const master = await prisma.independent_mst.findFirst({
    where: { MSTR_ID: i.authorityLevelId, TYP_ID: AUTHORITY_LEVEL_TYPE_ID },
    select: { MSTR_ID: true },
  });
  if (!master) fail('authorityLevelId', 'Select a valid authority level.');
  return { AUTHORITY_LEVEL_ID: i.authorityLevelId, VALUE: i.value };
}

const definition: ResourceDefinition<AuthorityLevelInput, AuthorityLevelInput, AuthorityLevelDto> = {
  label: 'Authority level',
  model: 'authority_level',
  primaryKey: 'ID',
  searchFields: ['VALUE'],
  sortFields: ['ID', 'AUTHORITY_LEVEL_ID', 'VALUE', 'OA_BRAND_ID'],
  defaultSort: { field: 'ID', dir: 'desc' },
  tenancy: { mode: 'brand', orgColumn: 'OA_ID', brandColumn: 'OA_BRAND_ID', userColumn: 'USER_ID', sysAdminMayChooseBrand: true },
  softDelete: { column: 'IS_DELETED', deleted: 1, active: 0 },
  audit: { createdBy: 'CREATED_BY', createdOn: 'CREATED_ON', updatedBy: 'UPDATED_BY', updatedOn: 'UPDATED_ON' },
  policy: menuPolicy('authoritylevel/authoritylevel'),
  createSchema: authorityLevelSchema,
  updateSchema: authorityLevelSchema,
  toCreateData: toData,
  toUpdateData: toData,
  hooks: {
    async enrichRows(rows) {
      const [masters, names] = await Promise.all([
        masterNames(rows.map((r) => r.AUTHORITY_LEVEL_ID as number)),
        nameMaps(rows, { brand: 'OA_BRAND_ID' }),
      ]);
      return rows.map((r) => ({
        ...r,
        _level: masters.get(r.AUTHORITY_LEVEL_ID as number)?.name ?? null,
        _brand: names.brand.get(r.OA_BRAND_ID as number) ?? null,
      }));
    },
  },
  toDto: (r) => ({
    id: r.ID as number,
    authorityLevelId: num(r.AUTHORITY_LEVEL_ID),
    authorityLevelName: str(r._level),
    value: str(r.VALUE),
    oaBrandId: num(r.OA_BRAND_ID),
    brandName: str(r._brand),
  }),
};

export const authorityLevelService = new ResourceService(definition);
