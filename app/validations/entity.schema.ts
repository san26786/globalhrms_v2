import { z } from 'zod';

/**
 * Entity module input schemas — CI form_validation rules of controllers/entity/* ported to zod
 * (server-side is authoritative; forms show the returned field errors). Deliberate fixes of CI
 * rules are noted per schema.
 */

const trimmed = (max: number) => z.string().trim().max(max, `Must be at most ${max} characters.`);
const requiredText = (max: number, label: string) => trimmed(max).min(1, `${label} is required.`);
const optionalText = (max: number) =>
  trimmed(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));
const requiredId = (label: string) =>
  z.coerce.number({ message: `${label} is required.` }).int(`${label} is required.`).positive(`${label} is required.`);
/** '' / null / undefined → null, otherwise a whole number ≥ 0. */
const optionalInt = (label: string) =>
  z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    z.union([z.null(), z.coerce.number().int(`${label} must be a whole number.`).min(0, `${label} cannot be negative.`)]),
  );
const requiredInt = (label: string) =>
  z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.coerce
      .number({ message: `${label} is required.` })
      .int(`${label} must be a whole number.`)
      .min(0, `${label} cannot be negative.`)
      .max(2_147_483_647, `${label} is too large.`),
  );
/** Checkbox: anything but a real "true" is false (CI stored NULL for an unchecked box). */
const flag = z.preprocess((v) => v === true || v === 'true' || v === 1 || v === '1', z.boolean());

export const OBJECT_TYPES = ['BASE TABLE', 'VIEW'] as const;
export type ObjectType = (typeof OBJECT_TYPES)[number];
const objectType = z.enum(OBJECT_TYPES, { message: 'Object type must be BASE TABLE or VIEW.' });

/**
 * PostgreSQL/MySQL object names. CI used alpha_numeric, which rejected '_' although nearly every
 * registered object name contains one — fixed.
 */
const OBJECT_NAME = /^[A-Za-z0-9_]+$/;
const OBJECT_NAME_MESSAGE = 'Only letters, numbers and underscores are allowed.';

/** CI entity_obj: Obj_Typ required; Obj_Nm required|max_length[50]|unique. */
export const entityObjSchema = z.object({
  objTyp: objectType,
  objNm: requiredText(50, 'Object name').regex(OBJECT_NAME, OBJECT_NAME_MESSAGE),
});
export type EntityObjInput = z.infer<typeof entityObjSchema>;

/**
 * Update variant: migrated rows have names up to 64 characters (column is varchar(100)), so an
 * unchanged long name must still save; the 50-character CI limit is enforced on a rename by the
 * resource hook.
 */
export const entityObjUpdateSchema = z.object({
  objTyp: objectType,
  objNm: requiredText(100, 'Object name').regex(OBJECT_NAME, OBJECT_NAME_MESSAGE),
});
export type EntityObjUpdateInput = z.infer<typeof entityObjUpdateSchema>;

/**
 * CI entity_obj_attrbt: ObjTyp required; ObjAttrbtNm required|max_length (column 40);
 * ObjAttrbtDtTyp required|max_length (column 40); ObjAttrbtSeq required; isNull/ObjSz/ObjPrcsn/ObjScl
 * optional; IsVisible checkbox. OBJ_NM comes from the parent object (objId), never from free text.
 */
const attributeFields = {
  objTyp: objectType,
  objAttrbtNm: requiredText(40, 'Attribute name'),
  objAttrbtDtTyp: requiredText(40, 'Data type'),
  objAttrbtSeq: requiredInt('Sequence'),
  isNull: z.enum(['YES', 'NO'], { message: 'Is Null must be YES or NO.' }).default('YES'),
  objSz: optionalInt('Size'),
  objPrcsn: optionalInt('Precision'),
  objScale: optionalInt('Scale'),
  isVisible: flag,
};
export const entityObjAttrbtCreateSchema = z.object({ objId: requiredId('Object'), ...attributeFields });
export type EntityObjAttrbtCreateInput = z.infer<typeof entityObjAttrbtCreateSchema>;
export const entityObjAttrbtUpdateSchema = z.object(attributeFields);
export type EntityObjAttrbtUpdateInput = z.infer<typeof entityObjAttrbtUpdateSchema>;

/**
 * Column configuration (CI entity_obj_attrbt::updateFlashModal + common_c::getLabel).
 * Every field of a row is optional: only what is sent is changed.
 */
export const displayConfigSchema = z.object({
  rows: z
    .array(
      z.object({
        attributeId: requiredId('Attribute'),
        /** Global entity_obj_attrbt.IS_VISIBLE — system admin only. */
        isVisible: z.boolean().optional(),
        label: trimmed(50).min(1, 'Label cannot be empty.').optional(),
        listView: z.boolean().optional(),
        formView: z.boolean().optional(),
      }),
    )
    .max(500, 'Too many rows.'),
});
export type DisplayConfigInput = z.infer<typeof displayConfigSchema>;

/**
 * CI entity_obj_attrbt_dsply_dtl: objNm required|max_length[40]; objAttrbtDsplyNm required.
 * The attribute must belong to the chosen object (validated server-side).
 */
export const displayDetailSchema = z.object({
  objNm: requiredText(100, 'Object'),
  objAttrbtId: requiredId('Attribute'),
  objAttrbtDsplyNm: requiredText(50, 'Display name'),
  isVisibleForListview: flag.default(true),
  isVisibleForFormview: flag.default(true),
  /** Sysadmin only: create the row for another brand. */
  oaBrandId: z.coerce.number().int().positive().optional(),
});
export type DisplayDetailInput = z.infer<typeof displayDetailSchema>;

/** CI obj_mppng: SrcLyr/TrgtLyr required|integer; source/target object required. */
export const objMappingSchema = z.object({
  srcLyrId: requiredId('Source layer'),
  srcObjId: requiredId('Source object'),
  trgtLyrId: requiredId('Target layer'),
  trgtObjId: requiredId('Target object'),
});
export type ObjMappingInput = z.infer<typeof objMappingSchema>;

/** CI entity_obj_attrbt_mppng: object mapping + source/target attribute required. */
export const attributeMappingSchema = z.object({
  objMppngId: requiredId('Object mapping'),
  srcAttributeId: requiredId('Source attribute'),
  trgAttributeId: requiredId('Target attribute'),
});
export type AttributeMappingInput = z.infer<typeof attributeMappingSchema>;

/** Replaces MySQL `SHOW COLUMNS … enum(…)` of entity_obj_attrbt_dependent_data.OBJ_FIELD_TYPE. */
export const FIELD_TYPES = ['TEXT', 'DROPDOWN', 'CHECKBOX', 'RADIO', 'NUMBER', 'FILE', 'DATE'] as const;

/** CI entity_obj_attrbt_dependent_data (edit only). */
export const dependentDataSchema = z.object({
  objAttrbtSeq: requiredInt('Sequence'),
  objTypeCode: optionalText(255),
  objFieldType: z.enum(FIELD_TYPES, { message: 'Select a valid field type.' }),
  isVisible: flag,
});
export type DependentDataInput = z.infer<typeof dependentDataSchema>;

/**
 * CI obj_attrbt_previleges: ObjectId, Obj_Attrbt_ID required; brand required and not 0
 * (callback_checkIfZero). The organisation is derived from the brand.
 */
export const attributePrivilegeSchema = z.object({
  objId: requiredId('Object'),
  objAttrbtId: requiredId('Object attribute'),
  oaBrandId: requiredId('Brand'),
});
export type AttributePrivilegeInput = z.infer<typeof attributePrivilegeSchema>;
