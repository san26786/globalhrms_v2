import { z } from 'zod';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { ValidationError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { currencies } from '@/lib/systmMngt/payslipSettings';
import { activeBrand, brandOrgId, type IdLabel } from '@/lib/systmMngt/shared';
import { countryOptions, form16Allowed, requireForm16 } from './shared';

/**
 * CI form16/form16_settings (index($code), a copy of the payslip settings screen): one form16_settings record per
 * brand — brand name / code / folder (read-only), prefix, currency, registered address, country, registration and
 * VAT numbers, bank account, the deductor's PAN / TAN, four instruction lines and "Mail Pdf". CI had no menu entry
 * for it; the form16/form16 grant governs it. The PAN / TAN prefill new Form 16s (hub/screens/form16.ts).
 *
 * Behaviour changes: the brand's record is found and edited (CI looked it up by a misspelt column, always opened the
 * add form and inserted another row on every save, and its form read an undefined id so no saved value ever showed);
 * the labels are the payslip settings' (form16_settings_vw has no Form Settings, so CI's live form hid every field
 * but Pan, Tan and Mail Pdf); brand name / code / folder come from the brand, not the posted read-only inputs;
 * Postal Code and Account No must be digits that fit their integer columns (CI's MySQL stored 0 or a clipped number);
 * a deleted record is not reopened. "Mail Pdf" is stored only — CI never mailed a Form 16.
 */

type TextField =
  | 'prefix' | 'reg_address' | 'reg_address_2' | 'reg_address_3' | 'postal_code' | 'city' | 'registration_no' | 'vat_no'
  | 'account_name' | 'account_no' | 'sort_code' | 'pan' | 'tan' | 'instruction_line_1' | 'instruction_line_2' | 'instruction_line_3' | 'instruction_line_4';

export type Form16SettingValues = Record<TextField | 'currency_id' | 'country', string> & { mail_pdf: boolean };

export interface Form16SettingsModel {
  title: string;
  mode: 'add' | 'edit';
  brand: { name: string; code: string; folder: string };
  values: Form16SettingValues;
  options: { currencies: IdLabel[]; countries: IdLabel[] };
  canSave: boolean;
}

interface Row {
  FORM16_SETTINGS_ID: number;
  FOLDER_LOC: string | null;
  REG_ADDRESS: string | null;
  REG_ADDRESS_2: string | null;
  REG_ADDRESS_3: string | null;
  POSTAL_CODE: number | null;
  CITY: string | null;
  COUNTRY: string | null;
  REGISTRATION_NO: string | null;
  VAT_NO: string | null;
  ACCOUNT_NAME: string | null;
  ACCOUNT_NO: number | null;
  SORT_CODE: string | null;
  PAN: string | null;
  TAN: string | null;
  INSTRUCTION_LINE_1: string | null;
  INSTRUCTION_LINE_2: string | null;
  INSTRUCTION_LINE_3: string | null;
  INSTRUCTION_LINE_4: string | null;
  MAIL_PDF: string | null;
  PREFIX: string | null;
  CURRENCY_ID: string | null;
  OA_BRAND_NM: string | null;
  OA_BRAND_CD: string | null;
}

/** CI getRecordIDByBrand(): the brand's (first live) form16_settings row. */
export async function brandForm16Settings(brand: number): Promise<Row | null> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT "FORM16_SETTINGS_ID", "FOLDER_LOC", "REG_ADDRESS", "REG_ADDRESS_2", "REG_ADDRESS_3", "POSTAL_CODE", "COUNTRY", "REGISTRATION_NO",
           "VAT_NO", "ACCOUNT_NAME", "ACCOUNT_NO", "SORT_CODE", "PAN", "TAN", "INSTRUCTION_LINE_1", "INSTRUCTION_LINE_2", "INSTRUCTION_LINE_3",
           "INSTRUCTION_LINE_4", "MAIL_PDF", "PREFIX", "CURRENCY_ID", "OA_BRAND_NM", "OA_BRAND_CD"
    FROM form16_settings WHERE "OA_BRAND_ID" = ${brand} AND "IS_DELETED" = 0 ORDER BY "FORM16_SETTINGS_ID" LIMIT 1`;
  return rows[0] ?? null;
}

async function brandInfo(brand: number) {
  const b = await prisma.oa_brands.findFirst({ where: { OA_BRAND_ID: brand }, select: { OA_BRAND_NM: true, OA_BRAND_CD: true, country: true } });
  return { name: b?.OA_BRAND_NM ?? '', code: b?.OA_BRAND_CD ?? '', country: b?.country ?? null };
}

const text = (label: string, required = false) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v === null || v === undefined ? '' : String(v)),
    required ? z.string().min(1, `The ${label} field is required.`).max(255, `The ${label} field cannot exceed 255 characters in length.`) : z.string().max(255, `The ${label} field cannot exceed 255 characters in length.`),
  );
/** Integer columns: digits only, within PostgreSQL integer. */
const digits = (label: string) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.replace(/\s+/g, '') : v === null || v === undefined ? '' : String(v)),
    z.string().refine((s) => s === '' || (/^\d{1,10}$/.test(s) && Number(s) <= 2147483647), `The ${label} field must be a number of at most 9 digits.`),
  );

const saveSchema = z.object({
  prefix: text('Prefix', true),
  reg_address: text('Address Line 1', true),
  account_name: text('Account Name', true),
  reg_address_2: text('Address Line 2'),
  reg_address_3: text('Address Line 3'),
  postal_code: digits('Postal Code'),
  city: text('City'),
  country: text('Country'),
  registration_no: text('Registration No'),
  vat_no: text('Vat No'),
  account_no: digits('Account No'),
  sort_code: text('Sort Code'),
  pan: text('Pan'),
  tan: text('Tan'),
  instruction_line_1: text('Instruction Line 1'),
  instruction_line_2: text('Instruction Line 2'),
  instruction_line_3: text('Instruction Line 3'),
  instruction_line_4: text('Instruction Line 4'),
  currency_id: z.preprocess((v) => (v === null || v === undefined ? '' : String(v).trim()), z.string().regex(/^\d*$/, 'Select a valid Currency.')),
  mail_pdf: z.preprocess((v) => v === true || v === 1 || v === '1' || v === 'on', z.boolean()),
});

const s = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v));
const nonZero = (v: string | number | null | undefined) => (s(v) === '0' ? '' : s(v));

export const form16SettingsService = {
  /** CI index($code) → initForm: the brand's record (edit) or a new one (add). */
  async load(subject: RequestSubject): Promise<Form16SettingsModel> {
    await requireForm16(subject, 'list');
    const brand = activeBrand(subject);
    const [record, info, currencyOptions, countries] = await Promise.all([brandForm16Settings(brand), brandInfo(brand), currencies(subject, brand), countryOptions()]);
    const canSave = await form16Allowed(subject, record ? 'update' : 'create');
    return {
      title: record ? 'Edit Form-16 Setting' : 'New Form-16 Setting',
      mode: record ? 'edit' : 'add',
      // CI add mode: brand name / code, folder = brand code, country = the brand's country.
      brand: { name: record?.OA_BRAND_NM || info.name, code: record?.OA_BRAND_CD || info.code, folder: record?.FOLDER_LOC || info.code },
      values: {
        prefix: s(record?.PREFIX),
        currency_id: nonZero(record?.CURRENCY_ID),
        reg_address: s(record?.REG_ADDRESS),
        reg_address_2: s(record?.REG_ADDRESS_2),
        reg_address_3: s(record?.REG_ADDRESS_3),
        postal_code: nonZero(record?.POSTAL_CODE),
        city: s(record?.CITY),
        country: record ? nonZero(record.COUNTRY) : s(info.country),
        registration_no: s(record?.REGISTRATION_NO),
        vat_no: s(record?.VAT_NO),
        account_name: s(record?.ACCOUNT_NAME),
        account_no: nonZero(record?.ACCOUNT_NO),
        sort_code: s(record?.SORT_CODE),
        pan: s(record?.PAN),
        tan: s(record?.TAN),
        instruction_line_1: s(record?.INSTRUCTION_LINE_1),
        instruction_line_2: s(record?.INSTRUCTION_LINE_2),
        instruction_line_3: s(record?.INSTRUCTION_LINE_3),
        instruction_line_4: s(record?.INSTRUCTION_LINE_4),
        mail_pdf: ['1', 'on', 'y', 'yes', 'true'].includes(s(record?.MAIL_PDF).toLowerCase()),
      },
      options: { currencies: currencyOptions, countries },
      canSave,
    };
  },

  /** CI insert($code) / update($code) → form16_settings_m. */
  async save(subject: RequestSubject, body: unknown): Promise<{ message: string }> {
    const brand = activeBrand(subject);
    const record = await brandForm16Settings(brand);
    await requireForm16(subject, record ? 'update' : 'create');
    const v = saveSchema.parse(body);
    const [info, currencyOptions, countries] = await Promise.all([brandInfo(brand), currencies(subject, brand), countryOptions()]);
    const errors: Record<string, string[]> = {};
    if (v.currency_id && !currencyOptions.some((c) => String(c.value) === v.currency_id) && v.currency_id !== nonZero(record?.CURRENCY_ID)) {
      errors.currency_id = ['Select a valid Currency.'];
    }
    if (v.country && !countries.some((c) => String(c.value) === v.country) && v.country !== nonZero(record?.COUNTRY)) errors.country = ['Select a valid Country.'];
    if (Object.keys(errors).length) throw new ValidationError('Validation failed.', errors);

    const folder = record?.FOLDER_LOC || info.code;
    const postal = v.postal_code ? Number(v.postal_code) : 0;
    const account = v.account_no ? Number(v.account_no) : 0;
    const mail = v.mail_pdf ? '1' : '0';
    const by = String(subject.userId);

    if (record) {
      await prisma.$executeRaw`
        UPDATE form16_settings SET
          "FOLDER_LOC" = ${folder}, "REG_ADDRESS" = ${v.reg_address}, "REG_ADDRESS_2" = ${v.reg_address_2}, "REG_ADDRESS_3" = ${v.reg_address_3},
          "POSTAL_CODE" = ${postal}, "COUNTRY" = ${v.country}, "REGISTRATION_NO" = ${v.registration_no}, "VAT_NO" = ${v.vat_no},
          "ACCOUNT_NAME" = ${v.account_name}, "ACCOUNT_NO" = ${account}, "SORT_CODE" = ${v.sort_code}, "PAN" = ${v.pan}, "TAN" = ${v.tan},
          "INSTRUCTION_LINE_1" = ${v.instruction_line_1}, "INSTRUCTION_LINE_2" = ${v.instruction_line_2},
          "INSTRUCTION_LINE_3" = ${v.instruction_line_3}, "INSTRUCTION_LINE_4" = ${v.instruction_line_4},
          "CITY" = ${v.city}, "MAIL_PDF" = ${mail}, "PREFIX" = ${v.prefix}, "CURRENCY_ID" = ${v.currency_id},
          "OA_BRAND_NM" = ${record.OA_BRAND_NM || info.name}, "OA_BRAND_CD" = ${record.OA_BRAND_CD || info.code},
          "UPDATED_BY" = ${by}, "UPDATED_ON" = now()
        WHERE "FORM16_SETTINGS_ID" = ${record.FORM16_SETTINGS_ID} AND "OA_BRAND_ID" = ${brand}`;
      return { message: 'Successfully Updated' };
    }

    await assertInsertSafe('form16_settings', 'FORM16_SETTINGS_ID');
    const oaId = await brandOrgId(brand, subject.oaId);
    await prisma.$executeRaw`
      INSERT INTO form16_settings (
        "EMP_ID", "FORM16_TEMPLATE", "REG_ADDRESS", "REG_ADDRESS_2", "REG_ADDRESS_3", "POSTAL_CODE", "CITY", "COUNTRY", "REGISTRATION_NO", "VAT_NO",
        "SORT_CODE", "FOLDER_LOC", "ACCOUNT_NAME", "ACCOUNT_NO", "STATUS_ID", "MAIL_PDF", "TEMPLATE_SETTING_ID", "CURRENCY_ID", "PREFIX", "PAN", "TAN",
        "SALARY", "INSTRUCTION_LINE_1", "INSTRUCTION_LINE_2", "INSTRUCTION_LINE_3", "INSTRUCTION_LINE_4", "OA_ID", "OA_BRAND_ID", "USER_ID",
        "IS_DELETED", "CREATED_ON", "CREATED_BY", "UPDATED_ON", "UPDATED_BY", "OA_BRAND_NM", "OA_BRAND_CD", "APPLICABLE_TAX", "CST")
      VALUES (
        '', '', ${v.reg_address}, ${v.reg_address_2}, ${v.reg_address_3}, ${postal}, ${v.city}, ${v.country}, ${v.registration_no}, ${v.vat_no},
        ${v.sort_code}, ${folder}, ${v.account_name}, ${account}, '', ${mail}, '', ${v.currency_id}, ${v.prefix}, ${v.pan}, ${v.tan},
        0, ${v.instruction_line_1}, ${v.instruction_line_2}, ${v.instruction_line_3}, ${v.instruction_line_4}, ${oaId}, ${brand}, ${subject.userId},
        0, now(), ${by}, now(), ${by}, ${info.name}, ${info.code}, '', '')`;
    return { message: 'Successfully Added' };
  },
};
