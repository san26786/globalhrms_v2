import { z } from 'zod';

/**
 * systmInfoMgr input schemas — CI form_validation rules ported 1:1 (server-side is authoritative;
 * the forms show the same messages via returned field errors).
 */

const trimmed = (max: number) => z.string().trim().max(max, `Must be at most ${max} characters.`);
const requiredText = (max: number, label: string) => trimmed(max).min(1, `${label} is required.`);
const optionalText = (max: number) =>
  trimmed(max)
    .optional()
    .transform((v) => (v ? v : null));
const requiredId = (label: string) =>
  z.coerce.number({ message: `${label} is required.` }).int().positive(`${label} is required.`);

/** CI systm_glssry: glssryCd required|alpha_numeric|max_length[10]|unique; glssryMnng required|max_length[25]. */
export const glossarySchema = z.object({
  code: requiredText(10, 'Glossary code').regex(/^[A-Za-z0-9]+$/, 'Only letters and numbers are allowed.'),
  meaning: requiredText(25, 'Glossary meaning'),
  description: optionalText(100),
});
export type GlossaryInput = z.infer<typeof glossarySchema>;

/** CI systm_lst_dtls: TBL_NM required; LST_NMBR required|integer|zeroValidate|max_length[10]. */
export const listDetailSchema = z.object({
  tableName: requiredText(50, 'Table name'),
  lastNumber: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.coerce
    .number({ message: 'Last number is required.' })
    .int('Last number must be a whole number.')
    .min(0, 'Last number cannot be negative.')
    .max(9_999_999_999, 'Last number must be at most 10 digits.'),
  ),
});
export type ListDetailInput = z.infer<typeof listDetailSchema>;

/**
 * CI systm_setting: refTypId required|integer, refId required, systmAttributeId required +
 * unique (attribute, organisation, brand); AttributeValueId / description optional.
 * REF_CD is derived server-side from the chosen reference (CI filled it via AJAX).
 */
export const systemSettingSchema = z.object({
  refTypeId: requiredId('Reference type'),
  refId: requiredId('Reference'),
  attributeId: requiredId('System attribute'),
  attributeValueId: z
    .union([z.literal(''), z.null(), z.coerce.number().int().nonnegative()])
    .optional()
    .transform((v) => (typeof v === 'number' ? v : null)),
  settingValue: optionalText(40),
  description: optionalText(255),
  isEnabled: z.boolean().default(true),
  isCurrent: z.boolean().default(false),
  /** Sysadmin only: create the setting for another brand (CI OrgDetailsView). */
  oaBrandId: z.coerce.number().int().positive().optional(),
});
export type SystemSettingInput = z.infer<typeof systemSettingSchema>;
