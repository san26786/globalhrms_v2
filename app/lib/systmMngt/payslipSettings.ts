import { z } from 'zod';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { getMasterId } from '@/lib/masters/masterService';
import { prisma } from '@/lib/prisma';
import { menuPolicy } from '@/lib/resource/policies';
import { activeBrand, authorize, brandOrgId, mastersOfTypeCode, type IdLabel } from './shared';

/**
 * CI payslip/payslip_settings (menu "Salary Slip Setting"; systmMngt/payslip_setting renders the
 * same form and posts to it): one payslip_settings record per brand — add when the brand has none,
 * otherwise edit it. Texts / labels are the payslip controller's (what users saw).
 *
 * Behaviour changes: the record is always the active brand's (CI accepted any id in the URL / post);
 * brand name / code / folder come from the brand, not from the posted read-only inputs; the
 * currency list also shows currencies whose CURR_CODE is a literal code (CI's inner join dropped
 * them, so a saved currency could not show as selected).
 * Raw SQL: the table's audit columns hold NULLs that the Prisma model declares required.
 */

const MENU = 'payslip/payslip_settings';

type TextField =
  | 'prefix' | 'reg_address' | 'reg_address_2' | 'reg_address_3' | 'postal_code' | 'city' | 'registration_no' | 'vat_no'
  | 'account_name' | 'account_no' | 'sort_code' | 'instruction_line_1' | 'instruction_line_2' | 'instruction_line_3' | 'instruction_line_4';

export type PayslipValues = Record<TextField | 'currency_id' | 'country' | 'payslip_template', string> & {
  mail_pdf: boolean;
};

export interface PayslipSettingsModel {
  title: string;
  mode: 'add' | 'edit';
  brand: { name: string; code: string; folder: string };
  values: PayslipValues;
  options: { currencies: IdLabel[]; countries: IdLabel[]; templates: IdLabel[] };
  canSave: boolean;
}

interface Row {
  PAYSLIP_SETTING_ID: number;
  FOLDER_LOC: string | null;
  PAYSLIP_TEMPLATE: string | null;
  REG_ADDRESS: string | null;
  REG_ADDRESS_2: string | null;
  REG_ADDRESS_3: string | null;
  POSTAL_CODE: string | null;
  COUNTRY: string | null;
  REGISTRATION_NO: string | null;
  VAT_NO: string | null;
  ACCOUNT_NAME: string | null;
  ACCOUNT_NO: string | null;
  SORT_CODE: string | null;
  INSTRUCTION_LINE_1: string | null;
  INSTRUCTION_LINE_2: string | null;
  INSTRUCTION_LINE_3: string | null;
  INSTRUCTION_LINE_4: string | null;
  CITY: string | null;
  MAIL_PDF: number | null;
  PREFIX: string | null;
  CURRENCY_ID: number | null;
  OA_BRAND_NM: string | null;
  OA_BRAND_CD: string | null;
}

/** CI getRecordIDByBrand(): the brand's first payslip_settings row. */
async function brandRecord(brand: number): Promise<Row | null> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT "PAYSLIP_SETTING_ID", "FOLDER_LOC", "PAYSLIP_TEMPLATE", "REG_ADDRESS", "REG_ADDRESS_2", "REG_ADDRESS_3",
           "POSTAL_CODE", "COUNTRY", "REGISTRATION_NO", "VAT_NO", "ACCOUNT_NAME", "ACCOUNT_NO", "SORT_CODE",
           "INSTRUCTION_LINE_1", "INSTRUCTION_LINE_2", "INSTRUCTION_LINE_3", "INSTRUCTION_LINE_4", "CITY",
           "MAIL_PDF", "PREFIX", "CURRENCY_ID", "OA_BRAND_NM", "OA_BRAND_CD"
    FROM payslip_settings WHERE "OA_BRAND_ID" = ${brand} ORDER BY "PAYSLIP_SETTING_ID" LIMIT 1`;
  return rows[0] ?? null;
}

async function brandInfo(brand: number) {
  const b = await prisma.oa_brands.findFirst({
    where: { OA_BRAND_ID: brand },
    select: { OA_BRAND_NM: true, OA_BRAND_CD: true, country: true },
  });
  return { name: b?.OA_BRAND_NM ?? '', code: b?.OA_BRAND_CD ?? '', country: b?.country ?? null };
}

/** CI invoice_setting_m::getAllCurrencyMst(): "{name} ({code})" of the brand's currencies. */
async function currencies(subject: RequestSubject, brand: number): Promise<IdLabel[]> {
  const rows = await prisma.$queryRaw<Array<{ value: number; label: string }>>`
    SELECT cm."CURR_ID" AS value,
           COALESCE(cm."CURR_NAME", '') || ' (' ||
             COALESCE((SELECT im."MSTR_CD" FROM independent_mst im WHERE im."MSTR_ID"::text = cm."CURR_CODE" LIMIT 1), cm."CURR_CODE") || ')' AS label
    FROM currency_mst cm
    WHERE cm."IS_DELETED" = 0 AND (${subject.adminLevel === 2} OR cm."OA_BRAND_ID" = ${brand})
    ORDER BY label, cm."CURR_ID"`;
  return rows.map((r) => ({ value: Number(r.value), label: r.label }));
}

/** CI getTemplate(getMasterIDFromCode('TPSSLIP')): salary slip templates. */
async function templates(): Promise<IdLabel[]> {
  const typeId = await getMasterId('TPSSLIP');
  if (!typeId) return [];
  const rows = await prisma.$queryRaw<Array<{ value: number; label: string }>>`
    SELECT DISTINCT "TEMPLATE_ID" AS value, "TEMPLATE_NAME" AS label FROM inv_template_mst
    WHERE "TEMPLATE_TYPE" = ${String(typeId)} ORDER BY value`;
  return rows.map((r) => ({ value: Number(r.value), label: r.label }));
}

const text = (label: string, required = false) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v ?? ''),
    required ? z.string().min(1, `The ${label} field is required.`) : z.string().max(500),
  );

const saveSchema = z.object({
  prefix: text('Prefix', true),
  reg_address: text('Reg Address', true),
  account_name: text('Account Name', true),
  payslip_template: text('Payslip Template', true),
  reg_address_2: text('Address Line 2'),
  reg_address_3: text('Address Line 3'),
  postal_code: text('Postal Code'),
  city: text('City'),
  country: text('Country'),
  registration_no: text('Registration No'),
  vat_no: text('Vat No'),
  account_no: text('Account No'),
  sort_code: text('Sort Code'),
  instruction_line_1: text('Instruction Line 1'),
  instruction_line_2: text('Instruction Line 2'),
  instruction_line_3: text('Instruction Line 3'),
  instruction_line_4: text('Instruction Line 4'),
  currency_id: z.preprocess((v) => (v === '' || v == null ? null : v), z.coerce.number().int().positive().nullable()),
  mail_pdf: z.preprocess((v) => v === true || v === 1 || v === '1', z.boolean()),
});

const nn = (v: string) => (v === '' ? null : v);

export const payslipSettingsService = {
  async load(subject: RequestSubject): Promise<PayslipSettingsModel> {
    await authorize(subject, MENU, 'list');
    const brand = activeBrand(subject);
    const [record, info, currencyOptions, countries, templateOptions] = await Promise.all([
      brandRecord(brand),
      brandInfo(brand),
      currencies(subject, brand),
      mastersOfTypeCode('HTGHN'),
      templates(),
    ]);
    const can = await menuPolicy(MENU).check(subject, record ? 'update' : 'create');
    const s = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v));
    return {
      title: record ? 'Edit Salary Slip Setting' : 'New Salary Slip Setting',
      mode: record ? 'edit' : 'add',
      // CI add mode: brand name / code, folder = brand code, country = the brand's country.
      brand: { name: record?.OA_BRAND_NM ?? info.name, code: record?.OA_BRAND_CD ?? info.code, folder: record?.FOLDER_LOC ?? info.code },
      values: {
        prefix: s(record?.PREFIX),
        currency_id: s(record?.CURRENCY_ID),
        reg_address: s(record?.REG_ADDRESS),
        reg_address_2: s(record?.REG_ADDRESS_2),
        reg_address_3: s(record?.REG_ADDRESS_3),
        postal_code: s(record?.POSTAL_CODE),
        city: s(record?.CITY),
        country: record ? s(record.COUNTRY) : s(info.country),
        registration_no: s(record?.REGISTRATION_NO),
        vat_no: s(record?.VAT_NO),
        account_name: s(record?.ACCOUNT_NAME),
        account_no: s(record?.ACCOUNT_NO),
        sort_code: s(record?.SORT_CODE),
        instruction_line_1: s(record?.INSTRUCTION_LINE_1),
        instruction_line_2: s(record?.INSTRUCTION_LINE_2),
        instruction_line_3: s(record?.INSTRUCTION_LINE_3),
        instruction_line_4: s(record?.INSTRUCTION_LINE_4),
        mail_pdf: record?.MAIL_PDF === 1,
        payslip_template: s(record?.PAYSLIP_TEMPLATE),
      },
      options: { currencies: currencyOptions, countries, templates: templateOptions },
      canSave: can,
    };
  },

  /** CI insert() / update() → payslip_settings_m. */
  async save(subject: RequestSubject, body: unknown): Promise<{ message: string }> {
    const brand = activeBrand(subject);
    const record = await brandRecord(brand);
    await authorize(subject, MENU, record ? 'update' : 'create');
    const v = saveSchema.parse(body);
    const info = await brandInfo(brand);
    const folder = record?.FOLDER_LOC ?? info.code;

    if (record) {
      await prisma.$executeRaw`
        UPDATE payslip_settings SET
          "FOLDER_LOC" = ${folder}, "PAYSLIP_TEMPLATE" = ${v.payslip_template}, "REG_ADDRESS" = ${v.reg_address},
          "REG_ADDRESS_2" = ${nn(v.reg_address_2)}, "REG_ADDRESS_3" = ${nn(v.reg_address_3)}, "POSTAL_CODE" = ${nn(v.postal_code)},
          "COUNTRY" = ${nn(v.country)}, "REGISTRATION_NO" = ${nn(v.registration_no)}, "VAT_NO" = ${nn(v.vat_no)},
          "ACCOUNT_NAME" = ${v.account_name}, "ACCOUNT_NO" = ${nn(v.account_no)}, "SORT_CODE" = ${nn(v.sort_code)},
          "INSTRUCTION_LINE_1" = ${nn(v.instruction_line_1)}, "INSTRUCTION_LINE_2" = ${nn(v.instruction_line_2)},
          "INSTRUCTION_LINE_3" = ${nn(v.instruction_line_3)}, "INSTRUCTION_LINE_4" = ${nn(v.instruction_line_4)},
          "CITY" = ${nn(v.city)}, "MAIL_PDF" = ${v.mail_pdf ? 1 : 0}, "PREFIX" = ${v.prefix}, "CURRENCY_ID" = ${v.currency_id},
          "OA_BRAND_NM" = ${record.OA_BRAND_NM ?? info.name}, "OA_BRAND_CD" = ${record.OA_BRAND_CD ?? info.code},
          "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now()
        WHERE "PAYSLIP_SETTING_ID" = ${record.PAYSLIP_SETTING_ID} AND "OA_BRAND_ID" = ${brand}`;
      return { message: 'Successfully Updated Salary Slip Setting' };
    }

    await assertInsertSafe('payslip_settings', 'PAYSLIP_SETTING_ID');
    const oaId = await brandOrgId(brand, subject.oaId);
    await prisma.$executeRaw`
      INSERT INTO payslip_settings (
        "FOLDER_LOC", "PAYSLIP_TEMPLATE", "REG_ADDRESS", "REG_ADDRESS_2", "REG_ADDRESS_3", "POSTAL_CODE", "COUNTRY",
        "REGISTRATION_NO", "VAT_NO", "ACCOUNT_NAME", "ACCOUNT_NO", "SORT_CODE", "INSTRUCTION_LINE_1", "INSTRUCTION_LINE_2",
        "INSTRUCTION_LINE_3", "INSTRUCTION_LINE_4", "CITY", "MAIL_PDF", "PREFIX", "CURRENCY_ID", "OA_ID", "OA_BRAND_ID",
        "USER_ID", "OA_BRAND_NM", "OA_BRAND_CD", "CREATED_BY", "CREATED_ON")
      VALUES (
        ${folder}, ${v.payslip_template}, ${v.reg_address}, ${nn(v.reg_address_2)}, ${nn(v.reg_address_3)}, ${nn(v.postal_code)},
        ${nn(v.country)}, ${nn(v.registration_no)}, ${nn(v.vat_no)}, ${v.account_name}, ${nn(v.account_no)}, ${nn(v.sort_code)},
        ${nn(v.instruction_line_1)}, ${nn(v.instruction_line_2)}, ${nn(v.instruction_line_3)}, ${nn(v.instruction_line_4)},
        ${nn(v.city)}, ${v.mail_pdf ? 1 : 0}, ${v.prefix}, ${v.currency_id}, ${oaId}, ${brand},
        ${subject.userId}, ${info.name}, ${info.code}, ${subject.userId}, now())`;
    return { message: 'Successfully Added New Salary Slip Setting' };
  },
};
