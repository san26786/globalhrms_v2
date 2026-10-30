import { z } from 'zod';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { bindColumns, tableColumns, type ColumnValue } from '@/lib/db/typedColumns';
import { ValidationError } from '@/lib/http/errors';
import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { getMasterId } from '@/lib/masters/masterService';
import { prisma } from '@/lib/prisma';
import { menuPolicy } from '@/lib/resource/policies';
import { currencies } from '@/lib/systmMngt/payslipSettings';
import { activeBrand, authorize, brandOrgId, mastersOfTypeCode, type IdLabel } from '@/lib/systmMngt/shared';
import { LETTER_SCREENS, type LetterScreenKey, type LetterSettingsModel, type LetterValues } from './letterScreens';

/**
 * CI exit_form/experience_letter_setting, exit_form/relieving_order_setting and exit_form/exit_form_setting
 * (Advance Settings): three copies of one controller. Each keeps one record per brand — add when the
 * brand has none, otherwise edit it — holding the letter header (prefix, currency, registered address,
 * country, registration / VAT numbers, bank account, four instruction lines, "Mail Pdf") and the letter
 * template (inv_template_mst of the screen's template type).
 *
 * Behaviour changes: the record is always the active brand's first row (CI's Experience / Relieving
 * update rewrote EVERY row of the brand, Exit Form trusted the posted id); brand name / code / folder
 * come from the brand, not from posted read-only inputs; currency labels show and the saved currency is
 * pre-selected (Experience / Relieving had blank labels, Relieving never pre-selected); Exit Form also
 * stores TEMPLATE_SETTING_ID like the other two; updates leave STATUS_ID / APPLICABLE_TAX / CST alone
 * (CI blanked them — the form has no such fields). Exit Form keeps CI's template list (salary slip
 * templates, TPSSLIP): no exit form template type exists.
 *
 * Column types differ per table (the migrated Experience / Relieving tables are all NOT NULL, with an
 * integer POSTAL_CODE and OA_BRAND_CD), so writes go through lib/db/typedColumns.
 */

interface RecordRow {
  id: number;
  values: Record<string, string | number | null>;
}

const FIELD_COLUMNS = {
  prefix: 'PREFIX',
  currency_id: 'CURRENCY_ID',
  reg_address: 'REG_ADDRESS',
  reg_address_2: 'REG_ADDRESS_2',
  reg_address_3: 'REG_ADDRESS_3',
  postal_code: 'POSTAL_CODE',
  city: 'CITY',
  country: 'COUNTRY',
  registration_no: 'REGISTRATION_NO',
  vat_no: 'VAT_NO',
  account_name: 'ACCOUNT_NAME',
  account_no: 'ACCOUNT_NO',
  sort_code: 'SORT_CODE',
  instruction_line_1: 'INSTRUCTION_LINE_1',
  instruction_line_2: 'INSTRUCTION_LINE_2',
  instruction_line_3: 'INSTRUCTION_LINE_3',
  instruction_line_4: 'INSTRUCTION_LINE_4',
} as const satisfies Partial<Record<keyof LetterValues, string>>;

/** CI getRecordIDByBrand(): the brand's first row of the screen's table. */
async function brandRecord(key: LetterScreenKey, brand: number): Promise<RecordRow | null> {
  const screen = LETTER_SCREENS[key];
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, string | number | null>>>(
    `SELECT * FROM "${screen.table}" WHERE "OA_BRAND_ID" = $1 ORDER BY "${screen.primaryKey}" LIMIT 1`,
    brand,
  );
  const row = rows[0];
  return row ? { id: Number(row[screen.primaryKey]), values: row } : null;
}

async function brandInfo(brand: number) {
  const b = await prisma.oa_brands.findFirst({
    where: { OA_BRAND_ID: brand },
    select: { OA_BRAND_NM: true, OA_BRAND_CD: true, country: true },
  });
  return { name: b?.OA_BRAND_NM ?? '', code: b?.OA_BRAND_CD ?? '', country: b?.country ?? null };
}

/** CI getTemplate(getMasterIDFromCode(code)): templates of the screen's template type. */
async function templates(code: string): Promise<IdLabel[]> {
  const typeId = await getMasterId(code);
  if (!typeId) return [];
  const rows = await prisma.$queryRaw<Array<{ value: number; label: string }>>`
    SELECT DISTINCT "TEMPLATE_ID" AS value, "TEMPLATE_NAME" AS label FROM inv_template_mst
    WHERE "TEMPLATE_TYPE" = ${String(typeId)} ORDER BY value`;
  return rows.map((r) => ({ value: Number(r.value), label: r.label }));
}

const text = (label: string, required = false) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v)),
    required ? z.string().min(1, `The ${label} field is required.`).max(255) : z.string().max(255, `The ${label} field cannot exceed 255 characters.`),
  );

const saveSchema = z.object({
  prefix: text('Prefix', true),
  reg_address: text('Reg Address', true),
  account_name: text('Account Name', true),
  currency_id: text('Currency'),
  reg_address_2: text('Reg Address 2'),
  reg_address_3: text('Reg Address 3'),
  postal_code: text('Postal Code'),
  city: text('City'),
  country: text('Country'),
  registration_no: text('Registration No'),
  vat_no: text('VAT No'),
  account_no: text('Account No'),
  sort_code: text('Sort Code'),
  instruction_line_1: text('Instruction Line 1'),
  instruction_line_2: text('Instruction Line 2'),
  instruction_line_3: text('Instruction Line 3'),
  instruction_line_4: text('Instruction Line 4'),
  template: text('Template'),
  mail_pdf: z.preprocess((v) => v === true || v === 1 || v === '1', z.boolean()),
});

const s = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v).trim());

export const letterSettingsService = {
  async load(subject: RequestSubject, key: LetterScreenKey): Promise<LetterSettingsModel> {
    const screen = LETTER_SCREENS[key];
    await authorize(subject, screen.menu, 'list');
    const brand = activeBrand(subject);
    const [record, info, currencyOptions, countries, templateOptions] = await Promise.all([
      brandRecord(key, brand),
      brandInfo(brand),
      currencies(subject, brand),
      mastersOfTypeCode('HTGHN'),
      templates(screen.templateCode),
    ]);
    const canSave = await menuPolicy(screen.menu).check(subject, record ? 'update' : 'create');
    const r = record?.values ?? {};
    const values = Object.fromEntries(Object.entries(FIELD_COLUMNS).map(([field, column]) => [field, s(r[column])])) as Record<
      keyof typeof FIELD_COLUMNS,
      string
    >;
    return {
      title: `${record ? 'Edit' : 'New'} ${screen.title}`,
      mode: record ? 'edit' : 'add',
      // CI add mode: brand name / code, folder = brand code, country = the brand's country.
      brand: { name: info.name, code: info.code, folder: s(r.FOLDER_LOC) || info.code },
      values: {
        ...values,
        country: record ? values.country : s(info.country),
        // The posted value of CI's checkbox was 1 (MAIL_PDF '1' / 1 when checked).
        mail_pdf: s(r.MAIL_PDF) === '1',
        template: s(r[screen.templateColumn]),
      },
      options: { currencies: currencyOptions, countries, templates: templateOptions },
      canSave,
    };
  },

  /** CI insert() / update() → <screen>_m, scoped to the active brand's record. */
  async save(subject: RequestSubject, key: LetterScreenKey, body: unknown): Promise<{ message: string }> {
    const screen = LETTER_SCREENS[key];
    const brand = activeBrand(subject);
    const record = await brandRecord(key, brand);
    await authorize(subject, screen.menu, record ? 'update' : 'create');
    const v = saveSchema.parse(body);

    const [columns, info, currencyOptions, countries, templateOptions] = await Promise.all([
      tableColumns(screen.table),
      brandInfo(brand),
      currencies(subject, brand),
      mastersOfTypeCode('HTGHN'),
      templates(screen.templateCode),
    ]);
    const errors: Record<string, string[]> = {};
    const oneOf = (field: 'currency_id' | 'country' | 'template', label: string, list: IdLabel[]) => {
      if (v[field] && !list.some((o) => String(o.value) === v[field])) errors[field] = [`Select a valid ${label}.`];
    };
    oneOf('currency_id', 'Currency', currencyOptions);
    oneOf('country', 'Country', countries);
    oneOf('template', 'Template', templateOptions);
    if (columns.get('POSTAL_CODE')?.integer && v.postal_code && !/^\d{1,9}$/.test(v.postal_code)) {
      errors.postal_code = ['The Postal Code field must contain only digits.'];
    }
    if (Object.keys(errors).length) throw new ValidationError('Validation failed.', errors);

    const data: Record<string, ColumnValue> = {
      ...Object.fromEntries(Object.entries(FIELD_COLUMNS).map(([field, column]) => [column, v[field as keyof typeof FIELD_COLUMNS]])),
      FOLDER_LOC: s(record?.values.FOLDER_LOC) || info.code,
      [screen.templateColumn]: v.template,
      TEMPLATE_SETTING_ID: v.template,
      MAIL_PDF: v.mail_pdf ? 1 : 0,
      OA_BRAND_NM: info.name,
      OA_BRAND_CD: info.code,
      UPDATED_BY: subject.userId,
    };

    const params: Array<string | null> = [];
    if (record) {
      const sets = bindColumns(columns,data, params).map((b) => `${b.column} = ${b.placeholder}`);
      params.push(String(record.id), String(brand));
      await prisma.$executeRawUnsafe(
        `UPDATE "${screen.table}" SET ${sets.join(', ')}, "UPDATED_ON" = now()
         WHERE "${screen.primaryKey}" = $${params.length - 1}::integer AND "OA_BRAND_ID" = $${params.length}::integer`,
        ...params,
      );
      return { message: 'Successfully Updated' };
    }

    await assertInsertSafe(screen.table, screen.primaryKey);
    const insert: Record<string, ColumnValue> = {
      ...data,
      OA_ID: await brandOrgId(brand, subject.oaId),
      OA_BRAND_ID: brand,
      USER_ID: subject.userId,
      CREATED_BY: subject.userId,
      IS_DELETED: 0,
      // NOT NULL in the Experience / Relieving tables; the form has no such fields.
      STATUS_ID: null,
      APPLICABLE_TAX: null,
      CST: null,
      PAN: null,
      REF_NO: null,
    };
    const pairs = bindColumns(columns,insert, params);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${screen.table}" (${pairs.map((p) => p.column).join(', ')}, "CREATED_ON", "UPDATED_ON")
       VALUES (${pairs.map((p) => p.placeholder).join(', ')}, now(), now())`,
      ...params,
    );
    return { message: 'Successfully Added' };
  },
};

/** A screen's API: GET → the brand's setting (add or edit form) · PUT → CI insert() / update(). */
export function letterSettingsRoutes(key: LetterScreenKey) {
  return {
    GET: withApi(async ({ subject }) => letterSettingsService.load(subject, key)),
    PUT: withApi(async ({ req, subject }) => {
      const result = await letterSettingsService.save(subject, key, await readJson(req));
      return ok(result, { message: result.message });
    }),
  };
}
