import { prisma } from '@/lib/prisma';
import { ConflictError, ValidationError } from '@/lib/http/errors';
import { ResourceService, type ResourceDefinition } from '@/lib/resource';
import { attributePrivilegeSchema, type AttributePrivilegeInput } from '@/validations/entity.schema';
import {
  ACTIVE,
  DELETED,
  attributeNames,
  brandNames,
  entityDefinitionPolicy,
  findActiveObject,
  idFilter,
  objectNames,
  requireAttributeOf,
  requireBrand,
} from '../entityShared';

/**
 * Object Attribute Privileges — CI controllers/entity/obj_attrbt_previleges.php.
 *
 * CONFIGURATION ONLY: CI stored these rows but never enforced them anywhere; enforcement is future
 * work (it would belong in the permission engine), so saving a privilege changes no access.
 *
 * Rules preserved: object and attribute required; brand required and not 0 (CI checkIfZero), the
 * organisation derived from the brand; list scoping (CI getTableDtl OA_ID / USER_ID): sysadmin all,
 * admin own organisation.
 * Differences: the attribute must belong to the chosen object (CI listed every attribute); one
 * active privilege per object + attribute + brand; soft delete (CI hard-deleted); writes are
 * system-admin only, reads for administrators.
 */
export interface AttributePrivilegeDto {
  id: number;
  objId: number;
  objName: string | null;
  objAttrbtId: number | null;
  objAttrbtName: string | null;
  oaId: number | null;
  oaBrandId: number | null;
  brandName: string | null;
  createdOn: string | null;
  updatedOn: string | null;
}

async function toData(input: AttributePrivilegeInput) {
  const object = await findActiveObject(input.objId);
  if (!object) throw new ValidationError('Validation failed.', { objId: ['Select a valid entity object.'] });
  const [attribute, brand] = await Promise.all([
    requireAttributeOf(input.objAttrbtId, object.OBJ_NM, 'objAttrbtId'),
    requireBrand(input.oaBrandId),
  ]);
  return {
    OBJ_ID: object.OBJ_ID,
    OBJ_ATTRBT_ID: attribute.OBJ_ATTRBT_ID,
    OA_ID: brand.OA_ID,
    OA_BRAND_ID: brand.OA_BRAND_ID,
  };
}

async function assertUnique(input: AttributePrivilegeInput, exceptId?: number) {
  const clash = await prisma.obj_attrbt_previleges.findFirst({
    where: {
      OBJ_ID: input.objId,
      OBJ_ATTRBT_ID: input.objAttrbtId,
      OA_BRAND_ID: input.oaBrandId,
      IS_DELETED: ACTIVE,
      ...(exceptId ? { NOT: { OBJ_ATTRBT_PREVILEGES_ID: exceptId } } : {}),
    },
    select: { OBJ_ATTRBT_PREVILEGES_ID: true },
  });
  if (clash) {
    const message = 'This attribute privilege already exists for the brand.';
    throw new ConflictError(message, { objAttrbtId: [message] });
  }
}

const definition: ResourceDefinition<AttributePrivilegeInput, AttributePrivilegeInput, AttributePrivilegeDto> = {
  label: 'Attribute privilege',
  model: 'obj_attrbt_previleges',
  primaryKey: 'OBJ_ATTRBT_PREVILEGES_ID',
  sortFields: ['OBJ_ATTRBT_PREVILEGES_ID', 'OBJ_ID', 'OBJ_ATTRBT_ID', 'OA_BRAND_ID'],
  defaultSort: { field: 'OBJ_ATTRBT_PREVILEGES_ID', dir: 'desc' },
  filters: { objId: { column: 'OBJ_ID', parse: idFilter } },
  tenancy: {
    mode: 'ci',
    scopeBy: 'org',
    orgColumn: 'OA_ID',
    brandColumn: 'OA_BRAND_ID',
    userColumn: 'USER_ID',
    sysAdminMayChooseBrand: true,
  },
  softDelete: { column: 'IS_DELETED', deleted: DELETED, active: ACTIVE },
  audit: { createdBy: 'CREATED_BY', createdOn: 'CREATED_ON', updatedBy: 'UPDATED_BY', updatedOn: 'UPDATED_ON' },
  policy: entityDefinitionPolicy,
  createSchema: attributePrivilegeSchema,
  updateSchema: attributePrivilegeSchema,
  // toData's OA_ID / OA_BRAND_ID win over the session stamp only on update; on create the
  // service stamps the brand chosen via `oaBrandId` (sysAdminMayChooseBrand) — the same brand.
  toCreateData: (i) => toData(i),
  toUpdateData: (i) => toData(i),
  hooks: {
    beforeCreate: (i) => assertUnique(i),
    beforeUpdate: (id, i) => assertUnique(i, id),
    async enrichRows(rows) {
      const [objects, attributes, brands] = await Promise.all([
        objectNames(rows.map((r) => r.OBJ_ID as number)),
        attributeNames(rows.map((r) => r.OBJ_ATTRBT_ID as number | null)),
        brandNames(rows.map((r) => r.OA_BRAND_ID as number | null)),
      ]);
      return rows.map((r) => ({
        ...r,
        _obj: objects.get(r.OBJ_ID as number) ?? null,
        _attr: attributes.get(r.OBJ_ATTRBT_ID as number) ?? null,
        _brand: brands.get(r.OA_BRAND_ID as number) ?? null,
      }));
    },
  },
  toDto: (r) => ({
    id: r.OBJ_ATTRBT_PREVILEGES_ID as number,
    objId: r.OBJ_ID as number,
    objName: (r._obj as string | null) ?? null,
    objAttrbtId: (r.OBJ_ATTRBT_ID as number | null) ?? null,
    objAttrbtName: (r._attr as string | null) ?? null,
    oaId: (r.OA_ID as number | null) ?? null,
    oaBrandId: (r.OA_BRAND_ID as number | null) ?? null,
    brandName: (r._brand as string | null) ?? null,
    createdOn: r.CREATED_ON instanceof Date ? r.CREATED_ON.toISOString() : null,
    updatedOn: r.UPDATED_ON instanceof Date ? r.UPDATED_ON.toISOString() : null,
  }),
};

export const objAttrbtPrevilegesService = new ResourceService(definition);
