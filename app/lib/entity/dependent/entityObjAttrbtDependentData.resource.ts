import { ResourceService, type ResourceDefinition } from '@/lib/resource';
import { dependentDataSchema, type DependentDataInput } from '@/validations/entity.schema';
import { ACTIVE, DELETED, entityEditOnlyPolicy } from '../entityShared';

/**
 * Entity Object Attribute Dependent Data — CI controllers/entity/entity_obj_attrbt_dependent_data.php.
 * Edit-only (CI had no insert/delete): sequence, type code, field type, visibility. Object and
 * attribute names are read-only.
 * Difference: the field-type options are a fixed list (CI read them from MySQL SHOW COLUMNS enum,
 * which PostgreSQL does not have); an unchecked "Is Visible" is stored as false (CI wrote NULL).
 */
export interface DependentDataDto {
  id: number;
  objTyp: string;
  objNm: string;
  objAttrbtNm: string;
  objAttrbtSeq: number;
  objTypeCode: string | null;
  objFieldType: string;
  isReq: boolean;
  isVisible: boolean;
  objTableColumn: string;
}

const definition: ResourceDefinition<never, DependentDataInput, DependentDataDto> = {
  label: 'Dependent data',
  model: 'entity_obj_attrbt_dependent_data',
  primaryKey: 'OBJ_ATTRBT_ID',
  searchFields: ['OBJ_NM', 'OBJ_ATTRBT_NM', 'OBJ_TYPE_CODE'],
  sortFields: ['OBJ_ATTRBT_ID', 'OBJ_NM', 'OBJ_ATTRBT_NM', 'OBJ_ATTRBT_SEQ'],
  defaultSort: { field: 'OBJ_NM', dir: 'asc' },
  filters: { objNm: { column: 'OBJ_NM', parse: (raw) => raw.trim() } },
  tenancy: { mode: 'none' },
  softDelete: { column: 'IS_DELETED', deleted: DELETED, active: ACTIVE },
  policy: entityEditOnlyPolicy,
  updateSchema: dependentDataSchema,
  toUpdateData: (i) => ({
    OBJ_ATTRBT_SEQ: i.objAttrbtSeq,
    OBJ_TYPE_CODE: i.objTypeCode,
    OBJ_FIELD_TYPE: i.objFieldType,
    IS_VISIBLE: i.isVisible,
  }),
  toDto: (r) => ({
    id: r.OBJ_ATTRBT_ID as number,
    objTyp: r.OBJ_TYP as string,
    objNm: r.OBJ_NM as string,
    objAttrbtNm: r.OBJ_ATTRBT_NM as string,
    objAttrbtSeq: r.OBJ_ATTRBT_SEQ as number,
    objTypeCode: (r.OBJ_TYPE_CODE as string | null) ?? null,
    objFieldType: (r.OBJ_FIELD_TYPE as string) ?? '',
    isReq: r.IS_REQ === true,
    isVisible: r.IS_VISIBLE === true,
    objTableColumn: (r.OBJ_TABLE_COLUMN as string) ?? '',
  }),
};

export const entityObjAttrbtDependentDataService = new ResourceService(definition);
