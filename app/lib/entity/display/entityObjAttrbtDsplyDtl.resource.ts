import { prisma } from '@/lib/prisma';
import { ConflictError, ValidationError } from '@/lib/http/errors';
import { ResourceService, readAllWriteAdmin, type ResourceContext, type ResourceDefinition } from '@/lib/resource';
import { displayDetailSchema, type DisplayDetailInput } from '@/validations/entity.schema';
import { ACTIVE, DELETED, brandNames, requireAttributeOf, requireBrand } from '../entityShared';

/**
 * Entity Object Attribute Display — CI controllers/entity/entity_obj_attrbt_dsply_dtl.php
 * (manual CRUD of entity_obj_attrbt_dsply_dtl).
 *
 * Rules preserved: object and display name required; the attribute is chosen from the attributes
 * of the object (CI DepnDropObjNm); OBJ_ATTRBT_SEQ = MAX(for OBJ_NM) + 1 on insert; list scoping
 * (CI getTableDtl with ORG_ACC_ID / USERID): sysadmin all, admin own organisation, user own rows;
 * org/brand/user stamped from the session, a sysadmin may choose the brand (CI OrgDetailsView).
 * Differences: the attribute must belong to the object (validated); OBJ_ATTRBT_NM is taken from
 * the attribute (CI posted it from a hidden field); one active row per attribute and brand;
 * soft delete (CI hard-deleted); writes need an administrator (users read their own rows).
 * System rows (OA_BRAND_ID NULL) are maintained on the entity's Display tab.
 */
export interface DisplayDetailDto {
  id: number;
  objAttrbtId: number;
  objNm: string;
  objAttrbtNm: string;
  objAttrbtDsplyNm: string;
  isVisibleForListview: boolean;
  isVisibleForFormview: boolean;
  seq: number | null;
  oaId: number | null;
  oaBrandId: number | null;
  brandName: string | null;
  isSystemRow: boolean;
}

async function targetBrand(input: DisplayDetailInput, ctx: ResourceContext): Promise<number | null> {
  if (ctx.subject.adminLevel === 2 && input.oaBrandId) return (await requireBrand(input.oaBrandId)).OA_BRAND_ID;
  return ctx.subject.oaBrandId;
}

async function assertUnique(attributeId: number, oaBrandId: number | null, exceptId?: number) {
  const clash = await prisma.entity_obj_attrbt_dsply_dtl.findFirst({
    where: {
      OBJ_ATTRBT_ID: attributeId,
      OA_BRAND_ID: oaBrandId,
      IS_DELETED: ACTIVE,
      ...(exceptId ? { NOT: { OBJ_ATTRBT_DSPLY_ID: exceptId } } : {}),
    },
    select: { OBJ_ATTRBT_DSPLY_ID: true },
  });
  if (clash) {
    const message = 'A display setting for this attribute already exists for the brand.';
    throw new ConflictError(message, { objAttrbtId: [message] });
  }
}

async function columns(input: DisplayDetailInput) {
  const attribute = await requireAttributeOf(input.objAttrbtId, input.objNm, 'objAttrbtId');
  return {
    OBJ_ATTRBT_ID: attribute.OBJ_ATTRBT_ID,
    OBJ_NM: attribute.OBJ_NM,
    OBJ_ATTRBT_NM: attribute.OBJ_ATTRBT_NM,
    OBJ_ATTRBT_DSPLY_NM: input.objAttrbtDsplyNm,
    IS_VISIBLE_FOR_LISTVIEW: input.isVisibleForListview ? 1 : 0,
    IS_VISIBLE_FOR_FORMVIEW: input.isVisibleForFormview ? 1 : 0,
  };
}

const definition: ResourceDefinition<DisplayDetailInput, DisplayDetailInput, DisplayDetailDto> = {
  label: 'Display setting',
  model: 'entity_obj_attrbt_dsply_dtl',
  primaryKey: 'OBJ_ATTRBT_DSPLY_ID',
  searchFields: ['OBJ_NM', 'OBJ_ATTRBT_NM', 'OBJ_ATTRBT_DSPLY_NM'],
  sortFields: ['OBJ_ATTRBT_DSPLY_ID', 'OBJ_NM', 'OBJ_ATTRBT_NM', 'OBJ_ATTRBT_DSPLY_NM', 'OA_BRAND_ID'],
  defaultSort: { field: 'OBJ_ATTRBT_DSPLY_ID', dir: 'desc' },
  filters: { objNm: { column: 'OBJ_NM', parse: (raw) => raw.trim() } },
  tenancy: {
    mode: 'ci',
    scopeBy: 'org',
    orgColumn: 'OA_ID',
    brandColumn: 'OA_BRAND_ID',
    userColumn: 'USER_ID',
    sysAdminMayChooseBrand: true,
  },
  softDelete: { column: 'IS_DELETED', deleted: DELETED, active: ACTIVE },
  policy: readAllWriteAdmin,
  createSchema: displayDetailSchema,
  updateSchema: displayDetailSchema,
  async toCreateData(input) {
    const data = await columns(input);
    const max = await prisma.entity_obj_attrbt_dsply_dtl.aggregate({
      where: { OBJ_NM: data.OBJ_NM },
      _max: { OBJ_ATTRBT_SEQ: true },
    });
    return { ...data, IS_DELETED: ACTIVE, OBJ_ATTRBT_SEQ: (max._max.OBJ_ATTRBT_SEQ ?? 0) + 1 };
  },
  toUpdateData: (input) => columns(input),
  hooks: {
    async beforeCreate(input, ctx) {
      await requireAttributeOf(input.objAttrbtId, input.objNm, 'objAttrbtId');
      const brand = await targetBrand(input, ctx);
      if (brand === null) throw new ValidationError('Validation failed.', { oaBrandId: ['Select a brand.'] });
      await assertUnique(input.objAttrbtId, brand);
    },
    beforeUpdate: (id, input, existing) => assertUnique(input.objAttrbtId, (existing.OA_BRAND_ID as number | null) ?? null, id),
    async enrichRows(rows) {
      const brands = await brandNames(rows.map((r) => r.OA_BRAND_ID as number | null));
      return rows.map((r) => ({ ...r, _brandName: brands.get(r.OA_BRAND_ID as number) ?? null }));
    },
  },
  toDto: (r) => ({
    id: r.OBJ_ATTRBT_DSPLY_ID as number,
    objAttrbtId: r.OBJ_ATTRBT_ID as number,
    objNm: r.OBJ_NM as string,
    objAttrbtNm: String(r.OBJ_ATTRBT_NM ?? '').trim(),
    objAttrbtDsplyNm: r.OBJ_ATTRBT_DSPLY_NM as string,
    isVisibleForListview: Number(r.IS_VISIBLE_FOR_LISTVIEW) === 1,
    isVisibleForFormview: Number(r.IS_VISIBLE_FOR_FORMVIEW) === 1,
    seq: (r.OBJ_ATTRBT_SEQ as number | null) ?? null,
    oaId: (r.OA_ID as number | null) ?? null,
    oaBrandId: (r.OA_BRAND_ID as number | null) ?? null,
    brandName: (r._brandName as string | null) ?? null,
    isSystemRow: r.OA_BRAND_ID === null,
  }),
};

export const entityObjAttrbtDsplyDtlService = new ResourceService(definition);
