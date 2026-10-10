import { prisma } from '@/lib/prisma';
import { ValidationError } from '@/lib/http/errors';
import { ResourceService, type ResourceDefinition } from '@/lib/resource';
import { attributeMappingSchema, type AttributeMappingInput } from '@/validations/entity.schema';
import {
  ACTIVE,
  DELETED,
  attributeNames,
  entityDefinitionPolicy,
  findActiveObject,
  idFilter,
  objectNames,
  requireAttributeOf,
  storedId,
} from '../entityShared';

/**
 * Entity Object Attribute Mapping — CI controllers/entity/entity_obj_attrbt_mppng.php.
 *
 * The form picks an object mapping (entity_obj_mppng); its source/target objects fix the two
 * attribute lists (CI ajaxDepnDropTrgNm / ajaxDepnDropObjMppngID / ajaxDepnDropObjAttrbtNm).
 * Storage kept for compatibility: CI stored the object and attribute IDS in the varchar *_NM
 * columns (SRC_OBJ_NM = OBJ_ID, SRC_OBJ_ATTRBT_NM = OBJ_ATTRBT_ID …) — so does this port.
 * Differences: every id is validated; the target attribute must belong to the TARGET object
 * (CI offered all attributes) and the source attribute to the source object; soft delete.
 */
export interface AttributeMappingDto {
  id: number;
  objMppngId: number;
  srcObjId: number | null;
  srcObjName: string | null;
  srcAttributeId: number | null;
  srcAttributeName: string | null;
  trgObjId: number | null;
  trgObjName: string | null;
  trgAttributeId: number | null;
  trgAttributeName: string | null;
}

async function toData(input: AttributeMappingInput) {
  const mapping = await prisma.entity_obj_mppng.findFirst({
    where: { OBJ_MPPNG_ID: input.objMppngId, IS_DELETED: ACTIVE },
    select: { SRC_OBJ_ID: true, TRGT_OBJ_ID: true },
  });
  if (!mapping) throw new ValidationError('Validation failed.', { objMppngId: ['Select a valid object mapping.'] });
  const [src, trg] = await Promise.all([findActiveObject(mapping.SRC_OBJ_ID), findActiveObject(mapping.TRGT_OBJ_ID)]);
  if (!src || !trg) {
    throw new ValidationError('Validation failed.', { objMppngId: ['The mapping refers to an entity object that no longer exists.'] });
  }
  const [srcAttr, trgAttr] = await Promise.all([
    requireAttributeOf(input.srcAttributeId, src.OBJ_NM, 'srcAttributeId'),
    requireAttributeOf(input.trgAttributeId, trg.OBJ_NM, 'trgAttributeId'),
  ]);
  return {
    OBJ_MPPNG_ID: input.objMppngId,
    SRC_OBJ_NM: String(src.OBJ_ID),
    SRC_OBJ_ATTRBT_NM: String(srcAttr.OBJ_ATTRBT_ID),
    TRG_OBJ_NM: String(trg.OBJ_ID),
    TRG_OBJ_ATTRBT_NM: String(trgAttr.OBJ_ATTRBT_ID),
  };
}

const definition: ResourceDefinition<AttributeMappingInput, AttributeMappingInput, AttributeMappingDto> = {
  label: 'Attribute mapping',
  model: 'entity_obj_attrbt_mppng',
  primaryKey: 'OBJ_ATTRBT_MPPNG_ID',
  sortFields: ['OBJ_ATTRBT_MPPNG_ID', 'OBJ_MPPNG_ID'],
  defaultSort: { field: 'OBJ_ATTRBT_MPPNG_ID', dir: 'desc' },
  filters: { objMppngId: { column: 'OBJ_MPPNG_ID', parse: idFilter } },
  tenancy: { mode: 'none' },
  softDelete: { column: 'IS_DELETED', deleted: DELETED, active: ACTIVE },
  policy: entityDefinitionPolicy,
  createSchema: attributeMappingSchema,
  updateSchema: attributeMappingSchema,
  toCreateData: (i) => toData(i),
  toUpdateData: (i) => toData(i),
  hooks: {
    async enrichRows(rows) {
      const [objects, attributes] = await Promise.all([
        objectNames(rows.flatMap((r) => [storedId(r.SRC_OBJ_NM), storedId(r.TRG_OBJ_NM)])),
        attributeNames(rows.flatMap((r) => [storedId(r.SRC_OBJ_ATTRBT_NM), storedId(r.TRG_OBJ_ATTRBT_NM)])),
      ]);
      return rows.map((r) => {
        const ids = {
          srcObj: storedId(r.SRC_OBJ_NM),
          trgObj: storedId(r.TRG_OBJ_NM),
          srcAttr: storedId(r.SRC_OBJ_ATTRBT_NM),
          trgAttr: storedId(r.TRG_OBJ_ATTRBT_NM),
        };
        return {
          ...r,
          _srcObj: ids.srcObj ? (objects.get(ids.srcObj) ?? null) : null,
          _trgObj: ids.trgObj ? (objects.get(ids.trgObj) ?? null) : null,
          _srcAttr: ids.srcAttr ? (attributes.get(ids.srcAttr) ?? null) : null,
          _trgAttr: ids.trgAttr ? (attributes.get(ids.trgAttr) ?? null) : null,
        };
      });
    },
  },
  toDto: (r) => ({
    id: r.OBJ_ATTRBT_MPPNG_ID as number,
    objMppngId: r.OBJ_MPPNG_ID as number,
    srcObjId: storedId(r.SRC_OBJ_NM),
    srcObjName: (r._srcObj as string | null) ?? null,
    srcAttributeId: storedId(r.SRC_OBJ_ATTRBT_NM),
    srcAttributeName: (r._srcAttr as string | null) ?? null,
    trgObjId: storedId(r.TRG_OBJ_NM),
    trgObjName: (r._trgObj as string | null) ?? null,
    trgAttributeId: storedId(r.TRG_OBJ_ATTRBT_NM),
    trgAttributeName: (r._trgAttr as string | null) ?? null,
  }),
};

export const entityObjAttrbtMppngService = new ResourceService(definition);
