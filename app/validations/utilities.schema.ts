import { z } from 'zod';

/**
 * utilities input schemas (server-side is authoritative; the pages only pre-check).
 */

const brandId = (message: string) =>
  z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.coerce.number({ message }).int(message).positive(message),
  );

const optionalBrandId = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.coerce.number().int().positive().optional(),
);

/** CI period_manager/generatePeriod/{oaId}/{oaBrandID}: "Please Select A Brand". */
export const periodGenerateSchema = z.object({
  oaBrandId: brandId('Please Select A Brand'),
});
export type PeriodGenerateInput = z.infer<typeof periodGenerateSchema>;

/** CI sync_company_settings/syncit: POST brands[] (CI crashed on an empty selection). */
export const syncCompanySettingsSchema = z.object({
  brandIds: z
    .array(z.coerce.number().int().positive(), { message: 'Please select at least one brand.' })
    .min(1, 'Please select at least one brand.')
    .max(1000, 'Too many brands selected.')
    .transform((ids) => [...new Set(ids)]),
});
export type SyncCompanySettingsInput = z.infer<typeof syncCompanySettingsSchema>;

/** CI export_employee/export: exportType withoutData | withData → withData=0|1. */
export const exportEmployeeQuerySchema = z.object({
  withData: z.enum(['0', '1']).default('0'),
});

/** CI import_export/export/{table}/{oa_id}/{oa_brand_id} — table is checked against a whitelist. */
export const tableExportQuerySchema = z.object({
  table: z
    .string({ message: 'Please Select A Table !' })
    .trim()
    .min(1, 'Please Select A Table !')
    .max(64)
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Unknown table.'),
  oaBrandId: optionalBrandId,
});
export type TableExportQuery = z.infer<typeof tableExportQuerySchema>;
