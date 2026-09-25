import { z } from 'zod';

/**
 * Master Data Manager (CI controllers/common/*) input schemas — CI form_validation rules ported;
 * the server is authoritative, the forms only mirror the messages via returned field errors.
 */

const trimmed = (max: number) => z.string().trim().max(max, `Must be at most ${max} characters.`);
const requiredText = (max: number, label: string) => trimmed(max).min(1, `${label} is required.`);
const optionalText = (max: number) =>
  trimmed(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));
const requiredId = (label: string) =>
  z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.coerce.number({ message: `${label} is required.` }).int(`${label} is required.`).positive(`${label} is required.`),
  );
/** Empty select / missing value → null. */
const optionalId = z.preprocess(
  (v) => (v === '' || v === null || v === undefined || v === 0 || v === '0' ? null : v),
  z.coerce.number().int().positive().nullable(),
);
const flag = z.preprocess((v) => v === true || v === 1 || v === '1' || v === 'true' || v === 'on', z.boolean());
const ALPHA_NUMERIC = /^[A-Za-z0-9]+$/;

/* ----------------------------------------------------------------- query params */

/** `?typeId=` on the master-data list / meta / options endpoints (CI index($MstrID)). */
export const masterTypeQuerySchema = z.object({
  typeId: optionalId.optional().transform((v) => v ?? null),
});

export const masterOptionsQuerySchema = z.object({
  kind: z.enum(['types', 'parents', 'countries', 'global-settings', 'menus']),
  typeId: optionalId.optional().transform((v) => v ?? null),
});
export type MasterOptionsKind = z.infer<typeof masterOptionsQuerySchema>['kind'];

/* ----------------------------------------------------------------- independent master data */

/**
 * CI indp_mst_data::setFormValidationRules:
 *   master_code trim|required|alpha_numeric|checkMasterCodeUnique (max 10 on the form);
 *   master_name trim|required (+ checkMasterName on insert); type_id required; master_desc trim.
 * The organisation-code prefix of non-system masters is added by the server (CI code_prefix).
 * Parent / global-settings / menu links are sysadmin-only controls; the server ignores them for others.
 */
export const masterDataSchema = z.object({
  typeId: requiredId('Type'),
  code: requiredText(10, 'Master Code').regex(ALPHA_NUMERIC, 'The Master Code field may only contain alpha-numeric characters.'),
  name: requiredText(400, 'Master Name'),
  description: optionalText(4000),
  countryId: optionalId.optional().transform((v) => v ?? null),
  parentId: optionalId.optional(),
  globalSettingId: optionalId.optional(),
  menuId: optionalId.optional(),
  /** Sysadmin only: the brand a non-system master belongs to (CI OrgDetailsView). */
  oaBrandId: optionalId.optional(),
});
export type MasterDataInput = z.infer<typeof masterDataSchema>;

/** CI indp_mst_data::replicateMstrForBrand/{typeId} ("Sync Masters"). */
export const masterSyncSchema = z.object({
  typeId: requiredId('Type'),
});

/* ----------------------------------------------------------------- common type (System Entities) */

const commonTypeFields = {
  code: requiredText(10, 'Type Code').regex(ALPHA_NUMERIC, 'The Type Code field may only contain alpha-numeric characters.'),
  name: requiredText(40, 'Type Name'),
  viewName: requiredText(40, 'View Name'),
  dataType: optionalText(20),
  visibleToUser: flag.default(false),
  userCanCreateData: flag.default(false),
  isEditable: flag.default(false),
  hasParent: flag.default(false),
  parentTypeId: optionalId.optional().transform((v) => v ?? null),
};

/** CI common_type insert: type_id required|integer|is_unique|zeroValidate (+ the shared rules). */
export const commonTypeCreateSchema = z.object({
  typeId: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.coerce
      .number({ message: 'Type Id is required.' })
      .int('The Type Id field must contain an integer.')
      .positive('The Type Id field must be greater than zero.')
      .max(2_147_483_647, 'Type Id is too large.'),
  ),
  ...commonTypeFields,
});
export type CommonTypeCreateInput = z.infer<typeof commonTypeCreateSchema>;

/** CI common_type update: the Type Id is the record key and is not changed. */
export const commonTypeUpdateSchema = z.object(commonTypeFields);
export type CommonTypeUpdateInput = z.infer<typeof commonTypeUpdateSchema>;

/* ----------------------------------------------------------------- config mapping */

/**
 * CI config_mapping_dtl form: Mapping_Type radio (menu mapping [module | epic] / GS mapping / board
 * type) + the source and target entity of that mapping.
 */
export const CONFIG_MAPPING_KINDS = ['module_menu', 'epic_menu', 'global_setting', 'board_type'] as const;
export type ConfigMappingKind = (typeof CONFIG_MAPPING_KINDS)[number];

export const configMappingSchema = z.object({
  mappingKind: z.enum(CONFIG_MAPPING_KINDS, { message: 'Mapping Type is required.' }),
  sourceId: requiredId('Source entity'),
  targetId: requiredId('Target entity'),
});
export type ConfigMappingInput = z.infer<typeof configMappingSchema>;

/* ----------------------------------------------------------------- module sync */

/** CI modulesync::$modules — the module employee tables "Sync Employee Details" fills from emp_mst. */
export const MODULE_SYNC_TABLES = [
  'achievment_employee',
  'attendance_employee',
  'kns_employee',
  'leave_employee',
  'outdrentr_employee',
  'pi_employee',
  'timesheet_employee',
  'mileage_employee',
  'checklist_employee',
  'loan_employee',
  'asset_employee',
  'expenses_employee',
] as const;
export type ModuleSyncTable = (typeof MODULE_SYNC_TABLES)[number];

/** CI modulesync::syncit/{table}/{oa_brand_id}. */
export const moduleSyncSchema = z.object({
  module: z.enum(MODULE_SYNC_TABLES, { message: 'Please select a module.' }),
  oaBrandId: optionalId.optional(),
});
export type ModuleSyncInput = z.infer<typeof moduleSyncSchema>;
