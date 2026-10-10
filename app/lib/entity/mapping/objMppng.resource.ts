import { prisma } from '@/lib/prisma';
import { BusinessRuleError, ValidationError } from '@/lib/http/errors';
import { ResourceService, type ResourceDefinition } from '@/lib/resource';
import { commonTypeNames } from '@/lib/masters/masterService';
import { objMappingSchema, type ObjMappingInput } from '@/validations/entity.schema';
import { ACTIVE, DELETED, LAYER_PARENT_TYPE_ID, entityDefinitionPolicy, idFilter, objectNames } from '../entityShared';

/**
 * Object Mapping — CI controllers/entity/obj_mppng.php (entity_obj_mppng).
 *
 * Rules preserved: source/target layer required integers (common_type children of type 27);
 * source/target object chosen from entity_obj.
 * Differences: layers and objects are validated to exist (CI trusted the posted ids); soft delete
 * (CI hard-deleted), refused while active attribute mappings use the mapping.
 */
export interface ObjMappingDto {
  id: number;
  srcLyrId: number;
  srcLyrName: string | null;
  srcObjId: number;
  srcObjName: string | null;
  trgtLyrId: number;
  trgtLyrName: string | null;
  trgtObjId: number;
  trgtObjName: string | null;
}

async function validate(input: ObjMappingInput) {
  const layerIds = [...new Set([input.srcLyrId, input.trgtLyrId])];
  const objIds = [...new Set([input.srcObjId, input.trgtObjId])];
  const [layers, objects] = await Promise.all([
    prisma.common_type.findMany({
      where: { TYP_ID: { in: layerIds }, PARENT_TYP_ID: LAYER_PARENT_TYPE_ID },
      select: { TYP_ID: true },
    }),
    prisma.entity_obj.findMany({ where: { OBJ_ID: { in: objIds }, IS_DELETED: ACTIVE }, select: { OBJ_ID: true } }),
  ]);
  const layerOk = new Set(layers.map((l) => l.TYP_ID));
  const objOk = new Set(objects.map((o) => o.OBJ_ID));
  const errors: Record<string, string[]> = {};
  if (!layerOk.has(input.srcLyrId)) errors.srcLyrId = ['Select a valid source layer.'];
  if (!layerOk.has(input.trgtLyrId)) errors.trgtLyrId = ['Select a valid target layer.'];
  if (!objOk.has(input.srcObjId)) errors.srcObjId = ['Select a valid source object.'];
  if (!objOk.has(input.trgtObjId)) errors.trgtObjId = ['Select a valid target object.'];
  if (Object.keys(errors).length) throw new ValidationError('Validation failed.', errors);
}

const toData = (i: ObjMappingInput) => ({
  SRC_LYR_ID: i.srcLyrId,
  SRC_OBJ_ID: i.srcObjId,
  TRGT_LYR_ID: i.trgtLyrId,
  TRGT_OBJ_ID: i.trgtObjId,
});

const definition: ResourceDefinition<ObjMappingInput, ObjMappingInput, ObjMappingDto> = {
  label: 'Object mapping',
  model: 'entity_obj_mppng',
  primaryKey: 'OBJ_MPPNG_ID',
  sortFields: ['OBJ_MPPNG_ID', 'SRC_OBJ_ID', 'TRGT_OBJ_ID', 'SRC_LYR_ID', 'TRGT_LYR_ID'],
  defaultSort: { field: 'OBJ_MPPNG_ID', dir: 'desc' },
  filters: {
    srcObjId: { column: 'SRC_OBJ_ID', parse: idFilter },
    trgtObjId: { column: 'TRGT_OBJ_ID', parse: idFilter },
  },
  tenancy: { mode: 'none' },
  softDelete: { column: 'IS_DELETED', deleted: DELETED, active: ACTIVE },
  policy: entityDefinitionPolicy,
  createSchema: objMappingSchema,
  updateSchema: objMappingSchema,
  toCreateData: toData,
  toUpdateData: toData,
  hooks: {
    beforeCreate: (i) => validate(i),
    beforeUpdate: (_id, i) => validate(i),
    async beforeDelete(id) {
      const used = await prisma.entity_obj_attrbt_mppng.count({ where: { OBJ_MPPNG_ID: id, IS_DELETED: ACTIVE } });
      if (used > 0) {
        throw new BusinessRuleError(
          `This object mapping is used by ${used} attribute mapping(s); delete those first.`,
          'OBJ_MAPPING_IN_USE',
        );
      }
    },
    async enrichRows(rows) {
      const [layers, objects] = await Promise.all([
        commonTypeNames(rows.flatMap((r) => [r.SRC_LYR_ID as number, r.TRGT_LYR_ID as number])),
        objectNames(rows.flatMap((r) => [r.SRC_OBJ_ID as number, r.TRGT_OBJ_ID as number])),
      ]);
      return rows.map((r) => ({
        ...r,
        _srcLyr: layers.get(r.SRC_LYR_ID as number) ?? null,
        _trgtLyr: layers.get(r.TRGT_LYR_ID as number) ?? null,
        _srcObj: objects.get(r.SRC_OBJ_ID as number) ?? null,
        _trgtObj: objects.get(r.TRGT_OBJ_ID as number) ?? null,
      }));
    },
  },
  toDto: (r) => ({
    id: r.OBJ_MPPNG_ID as number,
    srcLyrId: r.SRC_LYR_ID as number,
    srcLyrName: (r._srcLyr as string | null) ?? null,
    srcObjId: r.SRC_OBJ_ID as number,
    srcObjName: (r._srcObj as string | null) ?? null,
    trgtLyrId: r.TRGT_LYR_ID as number,
    trgtLyrName: (r._trgtLyr as string | null) ?? null,
    trgtObjId: r.TRGT_OBJ_ID as number,
    trgtObjName: (r._trgtObj as string | null) ?? null,
  }),
};

export const objMppngService = new ResourceService(definition);
