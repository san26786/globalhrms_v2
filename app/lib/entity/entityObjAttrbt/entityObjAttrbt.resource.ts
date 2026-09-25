import { prisma } from '@/lib/prisma';
import { ConflictError, ValidationError } from '@/lib/http/errors';
import { ResourceService, type ResourceDefinition } from '@/lib/resource';
import {
  entityObjAttrbtCreateSchema,
  entityObjAttrbtUpdateSchema,
  type EntityObjAttrbtCreateInput,
  type EntityObjAttrbtUpdateInput,
} from '@/validations/entity.schema';
import { ACTIVE, DELETED, entityDefinitionPolicy, findActiveObject } from '../entityShared';

/**
 * Entity Object Attribute — CI controllers/entity/entity_obj_attrbt.php (index/{OBJ_NM},
 * newEntityObjAttrbt, editEntityObjAttrbt, delete).
 *
 * Rules preserved: ObjTyp, ObjAttrbtNm, ObjAttrbtDtTyp, ObjAttrbtSeq required; IS_NULL / size /
 * precision / scale optional; IS_VISIBLE checkbox; list filtered by object (`?objNm=`).
 * Differences: OBJ_NM is fixed to the parent object (chosen by id, validated; not free text and
 * not changeable on edit); (OBJ_NM, OBJ_ATTRBT_NM) is unique among non-deleted rows (CI had no
 * rule); soft delete (CI hard-deleted); an unchecked "Is Visible" is stored as false (CI wrote NULL);
 * OBJ_SZ is NOT NULL in the schema, so an empty size is stored as 0.
 */
export interface EntityObjAttrbtDto {
  id: number;
  objTyp: string;
  objNm: string;
  objAttrbtNm: string;
  objAttrbtDtTyp: string;
  objAttrbtSeq: number;
  isNull: string;
  objSz: number | null;
  objPrcsn: number | null;
  objScale: number | null;
  objTypeCode: string | null;
  objFieldType: string | null;
  isVisible: boolean;
  objId: number | null;
}

async function assertNameUnique(objNm: string, attributeName: string, exceptId?: number) {
  const clash = await prisma.entity_obj_attrbt.findFirst({
    where: {
      OBJ_NM: objNm,
      OBJ_ATTRBT_NM: { equals: attributeName, mode: 'insensitive' },
      IS_DELETED: ACTIVE,
      ...(exceptId ? { NOT: { OBJ_ATTRBT_ID: exceptId } } : {}),
    },
    select: { OBJ_ATTRBT_ID: true },
  });
  if (clash) {
    const message = `"${objNm}" already has an attribute with this name.`;
    throw new ConflictError(message, { objAttrbtNm: [message] });
  }
}

async function requireParent(objId: number) {
  const parent = await findActiveObject(objId);
  if (!parent) throw new ValidationError('Validation failed.', { objId: ['Select a valid entity object.'] });
  return parent;
}

function columns(i: EntityObjAttrbtUpdateInput) {
  return {
    OBJ_TYP: i.objTyp,
    OBJ_ATTRBT_NM: i.objAttrbtNm,
    OBJ_ATTRBT_DT_TYP: i.objAttrbtDtTyp,
    OBJ_ATTRBT_SEQ: i.objAttrbtSeq,
    IS_NULL: i.isNull,
    OBJ_SZ: i.objSz ?? 0,
    OBJ_PRCSN: i.objPrcsn,
    OBJ_SCALE: i.objScale,
    IS_VISIBLE: i.isVisible,
  };
}

const definition: ResourceDefinition<EntityObjAttrbtCreateInput, EntityObjAttrbtUpdateInput, EntityObjAttrbtDto> = {
  label: 'Entity object attribute',
  model: 'entity_obj_attrbt',
  primaryKey: 'OBJ_ATTRBT_ID',
  searchFields: ['OBJ_ATTRBT_NM', 'OBJ_NM', 'OBJ_ATTRBT_DT_TYP'],
  sortFields: ['OBJ_ATTRBT_ID', 'OBJ_NM', 'OBJ_ATTRBT_NM', 'OBJ_ATTRBT_SEQ', 'OBJ_ATTRBT_DT_TYP'],
  defaultSort: { field: 'OBJ_ATTRBT_SEQ', dir: 'asc' },
  filters: { objNm: { column: 'OBJ_NM', parse: (raw) => raw.trim() } },
  tenancy: { mode: 'none' },
  softDelete: { column: 'IS_DELETED', deleted: DELETED, active: ACTIVE },
  policy: entityDefinitionPolicy,
  createSchema: entityObjAttrbtCreateSchema,
  updateSchema: entityObjAttrbtUpdateSchema,
  async toCreateData(i) {
    const parent = await requireParent(i.objId);
    return { ...columns(i), OBJ_NM: parent.OBJ_NM };
  },
  toUpdateData: (i) => columns(i),
  hooks: {
    async beforeCreate(i) {
      const parent = await requireParent(i.objId);
      await assertNameUnique(parent.OBJ_NM, i.objAttrbtNm);
    },
    beforeUpdate: (id, i, existing) => assertNameUnique(existing.OBJ_NM as string, i.objAttrbtNm, id),
    async enrichRows(rows) {
      const names = [...new Set(rows.map((r) => r.OBJ_NM as string))];
      const objects = await prisma.entity_obj.findMany({
        where: { OBJ_NM: { in: names }, IS_DELETED: ACTIVE },
        select: { OBJ_ID: true, OBJ_NM: true },
        orderBy: { OBJ_ID: 'asc' },
      });
      const idByName = new Map<string, number>();
      for (const o of objects) if (!idByName.has(o.OBJ_NM)) idByName.set(o.OBJ_NM, o.OBJ_ID);
      return rows.map((r) => ({ ...r, _objId: idByName.get(r.OBJ_NM as string) ?? null }));
    },
  },
  toDto: (r) => ({
    id: r.OBJ_ATTRBT_ID as number,
    objTyp: r.OBJ_TYP as string,
    objNm: r.OBJ_NM as string,
    objAttrbtNm: r.OBJ_ATTRBT_NM as string,
    objAttrbtDtTyp: r.OBJ_ATTRBT_DT_TYP as string,
    objAttrbtSeq: r.OBJ_ATTRBT_SEQ as number,
    isNull: (r.IS_NULL as string) ?? 'YES',
    objSz: (r.OBJ_SZ as number | null) ?? null,
    objPrcsn: (r.OBJ_PRCSN as number | null) ?? null,
    objScale: (r.OBJ_SCALE as number | null) ?? null,
    objTypeCode: (r.OBJ_TYPE_CODE as string | null) ?? null,
    objFieldType: (r.OBJ_FIELD_TYPE as string | null) ?? null,
    isVisible: r.IS_VISIBLE === true,
    objId: (r._objId as number | null) ?? null,
  }),
};

export const entityObjAttrbtService = new ResourceService(definition);
