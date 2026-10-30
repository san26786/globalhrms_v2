import { z } from 'zod';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { BusinessRuleError, NotFoundError, ValidationError } from '@/lib/http/errors';
import { getMasterId } from '@/lib/masters/masterService';
import { prisma } from '@/lib/prisma';
import { menuPolicy } from '@/lib/resource/policies';
import { currencies } from '@/lib/systmMngt/payslipSettings';
import { activeBrand, authorize, brandOrgId, mastersOfTypeCode, requireBrandAdmin } from '@/lib/systmMngt/shared';
import {
  APPLICABLE_TAXES,
  ORDER_SCREENS,
  isOrderSettingId,
  type ApplicableTax,
  type OrderSettingId,
  type OrderSettingsModel,
  type TemplateOption,
} from './orderScreens';

/**
 * CI organisation/invoice_setting/getSpecificSetting/{5569 | 5570} (Advance Settings → "Purchase Order
 * Setting" / "Sales Order Setting"): one org_acc_invoice_settings record per brand and setting
 * (TEMPLATE_SETTING_ID) — add when missing, otherwise edit it. Holds the document header: currency,
 * registered address, country, postal code, registration / VAT numbers, prefix, bank details, four
 * instruction lines, "Mail Pdf" and the template; India brands also have Food License, applicable
 * taxes, CST and PAN. Brand admins can "Sync Setting": copy the brand's Invoice Setting (5560) here.
 *
 * Behaviour changes: the record is always the active brand's (CI updated the posted id with no brand
 * check); brand name / code / folder come from the brand, not posted read-only inputs; field errors
 * name this screen (CI said "Proposal Prefix" / "Proposal Template" everywhere); the template and the
 * currency are only required when there is one to choose (no purchase / sales order templates were
 * migrated, so CI's rule would block every save); India-only columns are left alone for other brands
 * (CI blanked them); Sync also sets this screen's own template column (CI's REPLACE INTO cleared it)
 * and keeps the record id. Titles are the menu names (CI showed the master name of the setting id —
 * 5570 is "Business Administration" in this database).
 */

const TABLE_COLUMNS = `"ORG_ACC_INVOICE_SETTING_ID", "FOLDER_LOC", "ORG_TEMPLATE", "SALES_ORDER_TEMPLATE", "PURCHASE_ORDER_TEMPLATE",
  "REG_ADDRESS", "REG_ADDRESS_2", "REG_ADDRESS_3", "POSTAL_CODE", "COUNTRY", "REGISTRATION_NO", "VAT_NO", "FOOD_LICENSE",
  "BANK_NAME", "ACCOUNT_NAME", "ACCOUNT_NO", "SORT_CODE", "IFSC_CODE", "INSTRUCTION_LINE_1", "INSTRUCTION_LINE_2",
  "INSTRUCTION_LINE_3", "INSTRUCTION_LINE_4", "CITY", "MAIL_PDF", "INVOICE_PREFIX", "ORG_CURRENCY_ID", "APPLICABLE_TAX", "CST", "PAN"`;

type Row = Record<string, string | number | null>;

/** India (independent_mst 216): CI getorgCountryID() == 216 decides the India-only fields. */
const INDIA = 216;
const INVOICE_SETTING = 5560;

function screenOf(settingId: string): (typeof ORDER_SCREENS)[OrderSettingId] & { id: OrderSettingId } {
  if (!isOrderSettingId(settingId)) throw new NotFoundError('Setting not found.');
  return { ...ORDER_SCREENS[settingId], id: settingId };
}

/** CI getOrgAccInvoiceSettingIdfrombrand(brand, settingId): the brand's first record of that setting. */
async function brandRecord(brand: number, settingId: number): Promise<Row | null> {
  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT ${TABLE_COLUMNS} FROM org_acc_invoice_settings
     WHERE "OA_BRAND_ID" = $1 AND "TEMPLATE_SETTING_ID" = $2 ORDER BY "ORG_ACC_INVOICE_SETTING_ID" LIMIT 1`,
    brand,
    settingId,
  );
  return rows[0] ?? null;
}

async function brandInfo(brand: number) {
  const b = await prisma.oa_brands.findFirst({
    where: { OA_BRAND_ID: brand },
    select: { OA_BRAND_NM: true, OA_BRAND_CD: true, country: true },
  });
  return { name: b?.OA_BRAND_NM ?? '', code: b?.OA_BRAND_CD ?? '', country: b?.country ?? null };
}

/** CI get…Template(): inv_template_mst of the type, value = TEMPLATE_IMAGE. */
async function templates(templateType: string): Promise<TemplateOption[]> {
  const rows = await prisma.$queryRaw<Array<{ value: string; label: string | null }>>`
    SELECT DISTINCT ON ("TEMPLATE_IMAGE") "TEMPLATE_IMAGE" AS value, "TEMPLATE_NAME" AS label
    FROM inv_template_mst
    WHERE "TEMPLATE_TYPE" = ${templateType} AND COALESCE("TEMPLATE_IMAGE", '') <> ''
    ORDER BY "TEMPLATE_IMAGE", "TEMPLATE_ID"`;
  return rows.map((r) => ({ value: r.value, label: r.label ?? r.value }));
}

const s = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v).trim());
const nn = (v: string) => (v === '' ? null : v);

const ALNUM = /^[A-Za-z0-9]*$/;
const text = (label: string, opts: { required?: boolean; max?: number; alnum?: boolean; letters?: boolean } = {}) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v)),
    z
      .string()
      .max(opts.max ?? 255, `The ${label} field cannot exceed ${opts.max ?? 255} characters in length.`)
      .refine((v) => !opts.required || v !== '', `The ${label} field is required.`)
      .refine((v) => !opts.alnum || ALNUM.test(v), `The ${label} field may only contain alpha-numeric characters.`)
      .refine((v) => !opts.letters || /^[A-Za-z ]*$/.test(v), `The ${label} field may only contain letters and spaces.`),
  );
const checked = z.preprocess((v) => v === true || v === 1 || v === '1', z.boolean());

/** CI setFormValidationRules (error labels per screen instead of CI's "Proposal …"). */
function saveSchema(prefixLabel: string) {
  return z.object({
    org_currency_id: text('Currency'),
    reg_address: text('Register Address', { required: true }),
    reg_address_2: text('Address Line 2'),
    reg_address_3: text('Address Line 3'),
    city: text('City', { required: true }),
    country: text('Country', { required: true }),
    postal_code: text('Postal Code', { alnum: true }),
    registration_no: text('Registration No', { alnum: true, max: 30 }),
    food_license: text('Food License', { alnum: true, max: 20 }),
    vat_no: text('Vat No', { alnum: true, max: 20 }),
    cst: text('CST'),
    pan: text('PAN'),
    invoice_prefix: text(prefixLabel, { required: true, alnum: true }),
    bank_name: text('Bank Name'),
    account_name: text('Account Name', { required: true, letters: true }),
    account_no: text('Account No', { alnum: true }),
    sort_code: text('Sort Code', { alnum: true }),
    ifsc_code: text('IFSC Code', { alnum: true }),
    instruction_line_1: text('Instruction line 1'),
    instruction_line_2: text('Instruction line 2'),
    instruction_line_3: text('Instruction line 3'),
    instruction_line_4: text('Instruction line 4'),
    org_template: text('Template'),
    mail_pdf: checked,
    ...(Object.fromEntries(APPLICABLE_TAXES.map((t) => [t.key, checked])) as Record<ApplicableTax, typeof checked>),
  });
}

async function loadOptions(subject: RequestSubject, brand: number, templateType: string) {
  const [currencyOptions, countries, templateOptions] = await Promise.all([
    currencies(subject, brand),
    mastersOfTypeCode('HTGHN'),
    templates(templateType),
  ]);
  return { currencies: currencyOptions, countries, templates: templateOptions };
}

export const orderSettingsService = {
  async load(subject: RequestSubject, rawSettingId: string): Promise<OrderSettingsModel> {
    const screen = screenOf(rawSettingId);
    await authorize(subject, screen.menu, 'list');
    const brand = activeBrand(subject);
    const [record, info, options] = await Promise.all([
      brandRecord(brand, Number(screen.id)),
      brandInfo(brand),
      loadOptions(subject, brand, screen.templateType),
    ]);
    const policy = menuPolicy(screen.menu);
    const [canSave, canUpdate] = await Promise.all([policy.check(subject, record ? 'update' : 'create'), policy.check(subject, 'update')]);
    const r = record ?? {};
    const taxes = new Set(s(r.APPLICABLE_TAX).split(';').filter(Boolean));
    return {
      settingId: screen.id,
      title: `${record ? 'Edit' : 'Add'} ${screen.title}`,
      mode: record ? 'edit' : 'add',
      brand: { name: info.name, code: info.code, folder: s(r.FOLDER_LOC) || info.code },
      isIndia: info.country === INDIA,
      values: {
        org_currency_id: s(r.ORG_CURRENCY_ID),
        reg_address: s(r.REG_ADDRESS),
        reg_address_2: s(r.REG_ADDRESS_2),
        reg_address_3: s(r.REG_ADDRESS_3),
        city: s(r.CITY),
        // CI add mode: the brand's country.
        country: record ? s(r.COUNTRY) : s(info.country),
        postal_code: s(r.POSTAL_CODE),
        registration_no: s(r.REGISTRATION_NO),
        food_license: s(r.FOOD_LICENSE),
        vat_no: s(r.VAT_NO),
        cst: s(r.CST),
        pan: s(r.PAN),
        invoice_prefix: s(r.INVOICE_PREFIX),
        bank_name: s(r.BANK_NAME),
        account_name: s(r.ACCOUNT_NAME),
        account_no: s(r.ACCOUNT_NO),
        sort_code: s(r.SORT_CODE),
        ifsc_code: s(r.IFSC_CODE),
        instruction_line_1: s(r.INSTRUCTION_LINE_1),
        instruction_line_2: s(r.INSTRUCTION_LINE_2),
        instruction_line_3: s(r.INSTRUCTION_LINE_3),
        instruction_line_4: s(r.INSTRUCTION_LINE_4),
        mail_pdf: s(r.MAIL_PDF) === '1',
        org_template: s(r[screen.templateColumn]),
        ...(Object.fromEntries(APPLICABLE_TAXES.map((t) => [t.key, taxes.has(t.key)])) as Record<ApplicableTax, boolean>),
      },
      options,
      canSave,
      canSync: subject.adminLevel === 1 && canUpdate,
    };
  },

  /** CI insert($settingId) / update($id, $settingId) → invoice_setting_m. */
  async save(subject: RequestSubject, rawSettingId: string, body: unknown): Promise<{ message: string }> {
    const screen = screenOf(rawSettingId);
    const settingId = Number(screen.id);
    const brand = activeBrand(subject);
    const record = await brandRecord(brand, settingId);
    await authorize(subject, screen.menu, record ? 'update' : 'create');
    const v = saveSchema(screen.prefixLabel).parse(body);

    const [info, options] = await Promise.all([brandInfo(brand), loadOptions(subject, brand, screen.templateType)]);
    const errors: Record<string, string[]> = {};
    const pick = (field: 'org_currency_id' | 'country' | 'org_template', label: string, list: Array<{ value: number | string }>) => {
      if (!v[field] && list.length && field !== 'country') errors[field] = [`The ${label} field is required.`];
      else if (v[field] && !list.some((o) => String(o.value) === v[field])) errors[field] = [`Select a valid ${label}.`];
    };
    pick('org_currency_id', 'Currency', options.currencies);
    pick('country', 'Country', options.countries);
    pick('org_template', screen.templateLabel.replace(/^Select /, ''), options.templates);
    if (Object.keys(errors).length) throw new ValidationError('Validation failed.', errors);

    const india = info.country === INDIA;
    const taxes = APPLICABLE_TAXES.filter((t) => v[t.key]).map((t) => t.key).join(';');
    const template = nn(v.org_template);
    const currency = v.org_currency_id ? Number(v.org_currency_id) : null;
    const folder = s(record?.FOLDER_LOC) || info.code;

    if (record) {
      const id = Number(record.ORG_ACC_INVOICE_SETTING_ID);
      await prisma.$transaction([
        prisma.$executeRaw`
          UPDATE org_acc_invoice_settings SET
            "FOLDER_LOC" = ${folder}, "ORG_TEMPLATE" = ${template}, "PAYMENT_TEMPLATE" = ${template}, "CREDITNOTE_TEMPLATE" = ${template},
            "SALES_ORDER_TEMPLATE" = ${template}, "PURCHASE_ORDER_TEMPLATE" = ${template},
            "REG_ADDRESS" = ${v.reg_address}, "REG_ADDRESS_2" = ${nn(v.reg_address_2)}, "REG_ADDRESS_3" = ${nn(v.reg_address_3)},
            "POSTAL_CODE" = ${nn(v.postal_code)}, "COUNTRY" = ${v.country}, "REGISTRATION_NO" = ${nn(v.registration_no)},
            "VAT_NO" = ${nn(v.vat_no)}, "BANK_NAME" = ${nn(v.bank_name)}, "ACCOUNT_NAME" = ${v.account_name},
            "ACCOUNT_NO" = ${nn(v.account_no)}, "SORT_CODE" = ${nn(v.sort_code)}, "IFSC_CODE" = ${nn(v.ifsc_code)},
            "INSTRUCTION_LINE_1" = ${nn(v.instruction_line_1)}, "INSTRUCTION_LINE_2" = ${nn(v.instruction_line_2)},
            "INSTRUCTION_LINE_3" = ${nn(v.instruction_line_3)}, "INSTRUCTION_LINE_4" = ${nn(v.instruction_line_4)},
            "CITY" = ${v.city}, "MAIL_PDF" = ${v.mail_pdf ? 1 : 0}, "INVOICE_PREFIX" = ${v.invoice_prefix},
            "ORG_CURRENCY_ID" = ${currency}, "OA_BRAND_NM" = ${info.name}, "OA_BRAND_CD" = ${info.code},
            "FOOD_LICENSE" = ${india ? nn(v.food_license) : record.FOOD_LICENSE}, "APPLICABLE_TAX" = ${india ? nn(taxes) : record.APPLICABLE_TAX},
            "CST" = ${india ? nn(v.cst) : record.CST}, "PAN" = ${india ? nn(v.pan) : record.PAN},
            "USER_ID" = ${subject.userId}, "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now()
          WHERE "ORG_ACC_INVOICE_SETTING_ID" = ${id} AND "OA_BRAND_ID" = ${brand} AND "TEMPLATE_SETTING_ID" = ${settingId}`,
        // CI update(): the welcome tour's first step ("fill in your settings") is done.
        prisma.$executeRaw`UPDATE welcome_tour_status SET "STATUS" = 1 WHERE "STEP_NO" = 1 AND "USER_ID" = ${subject.userId}`,
      ]);
      return { message: 'Successfully Updated' };
    }

    await assertInsertSafe('org_acc_invoice_settings', 'ORG_ACC_INVOICE_SETTING_ID');
    const oaId = await brandOrgId(brand, subject.oaId);
    await prisma.$executeRaw`
      INSERT INTO org_acc_invoice_settings (
        "FOLDER_LOC", "ORG_TEMPLATE", "PAYMENT_TEMPLATE", "CREDITNOTE_TEMPLATE", "SALES_ORDER_TEMPLATE", "PURCHASE_ORDER_TEMPLATE",
        "REG_ADDRESS", "REG_ADDRESS_2", "REG_ADDRESS_3", "POSTAL_CODE", "COUNTRY", "REGISTRATION_NO", "VAT_NO", "FOOD_LICENSE",
        "BANK_NAME", "ACCOUNT_NAME", "ACCOUNT_NO", "SORT_CODE", "IFSC_CODE", "INSTRUCTION_LINE_1", "INSTRUCTION_LINE_2",
        "INSTRUCTION_LINE_3", "INSTRUCTION_LINE_4", "CITY", "MAIL_PDF", "INVOICE_PREFIX", "TEMPLATE_SETTING_ID", "ORG_CURRENCY_ID",
        "OA_ID", "OA_BRAND_ID", "USER_ID", "IS_DELETED", "OA_BRAND_NM", "OA_BRAND_CD", "APPLICABLE_TAX", "CST", "PAN",
        "CREATED_BY", "CREATED_ON", "UPDATED_BY", "UPDATED_ON")
      VALUES (
        ${folder}, ${template}, ${template}, ${template}, ${template}, ${template},
        ${v.reg_address}, ${nn(v.reg_address_2)}, ${nn(v.reg_address_3)}, ${nn(v.postal_code)}, ${v.country},
        ${nn(v.registration_no)}, ${nn(v.vat_no)}, ${india ? nn(v.food_license) : null},
        ${nn(v.bank_name)}, ${v.account_name}, ${nn(v.account_no)}, ${nn(v.sort_code)}, ${nn(v.ifsc_code)},
        ${nn(v.instruction_line_1)}, ${nn(v.instruction_line_2)}, ${nn(v.instruction_line_3)}, ${nn(v.instruction_line_4)},
        ${v.city}, ${v.mail_pdf ? 1 : 0}, ${v.invoice_prefix}, ${settingId}, ${currency},
        ${oaId}, ${brand}, ${subject.userId}, 0, ${info.name}, ${info.code},
        ${india ? nn(taxes) : null}, ${india ? nn(v.cst) : null}, ${india ? nn(v.pan) : null},
        ${subject.userId}, now(), ${subject.userId}, now())`;
    return { message: 'Successfully Added' };
  },

  /**
   * CI syncSetting($settingId), brand admins: this setting becomes a copy of the brand's Invoice
   * Setting (5560), with the first template of the screen's template type.
   */
  async sync(subject: RequestSubject, rawSettingId: string): Promise<{ message: string }> {
    const screen = screenOf(rawSettingId);
    const settingId = Number(screen.id);
    await authorize(subject, screen.menu, 'update');
    requireBrandAdmin(subject);
    const brand = activeBrand(subject);
    const [invoice, target] = await Promise.all([brandRecord(brand, INVOICE_SETTING), brandRecord(brand, settingId)]);
    if (!invoice) throw new BusinessRuleError('Please Fill Invoice Settings to Sync', 'NO_INVOICE_SETTING');

    const typeId = await getMasterId(screen.syncTemplateCode);
    const [first] = typeId
      ? await prisma.$queryRaw<Array<{ image: string | null }>>`
          SELECT "TEMPLATE_IMAGE" AS image FROM inv_template_mst WHERE "TEMPLATE_TYPE" = ${String(typeId)} ORDER BY "TEMPLATE_ID" LIMIT 1`
      : [];
    const image = first?.image ?? null;
    const sourceId = Number(invoice.ORG_ACC_INVOICE_SETTING_ID);

    if (target) {
      await prisma.$executeRaw`
        UPDATE org_acc_invoice_settings t SET
          "FOLDER_LOC" = src."FOLDER_LOC", "ORG_TEMPLATE" = ${image}, "PAYMENT_TEMPLATE" = ${image}, "CREDITNOTE_TEMPLATE" = ${image},
          "SALES_ORDER_TEMPLATE" = ${image}, "PURCHASE_ORDER_TEMPLATE" = ${image},
          "REG_ADDRESS" = src."REG_ADDRESS", "REG_ADDRESS_2" = src."REG_ADDRESS_2", "REG_ADDRESS_3" = src."REG_ADDRESS_3",
          "POSTAL_CODE" = src."POSTAL_CODE", "COUNTRY" = src."COUNTRY", "REGISTRATION_NO" = src."REGISTRATION_NO",
          "VAT_NO" = src."VAT_NO", "FOOD_LICENSE" = src."FOOD_LICENSE", "STATUS_ID" = src."STATUS_ID", "BANK_NAME" = src."BANK_NAME",
          "ACCOUNT_NAME" = src."ACCOUNT_NAME", "ACCOUNT_NO" = src."ACCOUNT_NO", "SORT_CODE" = src."SORT_CODE",
          "IFSC_CODE" = src."IFSC_CODE", "INSTRUCTION_LINE_1" = src."INSTRUCTION_LINE_1", "INSTRUCTION_LINE_2" = src."INSTRUCTION_LINE_2",
          "INSTRUCTION_LINE_3" = src."INSTRUCTION_LINE_3", "INSTRUCTION_LINE_4" = src."INSTRUCTION_LINE_4", "CITY" = src."CITY",
          "MAIL_PDF" = src."MAIL_PDF", "INVOICE_PREFIX" = src."INVOICE_PREFIX", "ORG_CURRENCY_ID" = src."ORG_CURRENCY_ID",
          "OA_BRAND_NM" = src."OA_BRAND_NM", "OA_BRAND_CD" = src."OA_BRAND_CD", "APPLICABLE_TAX" = src."APPLICABLE_TAX",
          "CST" = src."CST", "PAN" = src."PAN", "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now()
        FROM org_acc_invoice_settings src
        WHERE src."ORG_ACC_INVOICE_SETTING_ID" = ${sourceId}
          AND t."ORG_ACC_INVOICE_SETTING_ID" = ${Number(target.ORG_ACC_INVOICE_SETTING_ID)} AND t."OA_BRAND_ID" = ${brand}`;
    } else {
      await assertInsertSafe('org_acc_invoice_settings', 'ORG_ACC_INVOICE_SETTING_ID');
      await prisma.$executeRaw`
        INSERT INTO org_acc_invoice_settings (
          "FOLDER_LOC", "ORG_TEMPLATE", "PAYMENT_TEMPLATE", "CREDITNOTE_TEMPLATE", "SALES_ORDER_TEMPLATE", "PURCHASE_ORDER_TEMPLATE",
          "REG_ADDRESS", "REG_ADDRESS_2", "REG_ADDRESS_3", "POSTAL_CODE", "COUNTRY", "REGISTRATION_NO", "VAT_NO", "FOOD_LICENSE",
          "STATUS_ID", "BANK_NAME", "ACCOUNT_NAME", "ACCOUNT_NO", "SORT_CODE", "IFSC_CODE", "INSTRUCTION_LINE_1", "INSTRUCTION_LINE_2",
          "INSTRUCTION_LINE_3", "INSTRUCTION_LINE_4", "CITY", "MAIL_PDF", "INVOICE_PREFIX", "TEMPLATE_SETTING_ID", "ORG_CURRENCY_ID",
          "OA_ID", "OA_BRAND_ID", "USER_ID", "IS_DELETED", "OA_BRAND_NM", "OA_BRAND_CD", "APPLICABLE_TAX", "CST", "PAN",
          "CREATED_BY", "CREATED_ON", "UPDATED_BY", "UPDATED_ON")
        SELECT
          src."FOLDER_LOC", ${image}, ${image}, ${image}, ${image}, ${image},
          src."REG_ADDRESS", src."REG_ADDRESS_2", src."REG_ADDRESS_3", src."POSTAL_CODE", src."COUNTRY", src."REGISTRATION_NO",
          src."VAT_NO", src."FOOD_LICENSE", src."STATUS_ID", src."BANK_NAME", src."ACCOUNT_NAME", src."ACCOUNT_NO", src."SORT_CODE",
          src."IFSC_CODE", src."INSTRUCTION_LINE_1", src."INSTRUCTION_LINE_2", src."INSTRUCTION_LINE_3", src."INSTRUCTION_LINE_4",
          src."CITY", src."MAIL_PDF", src."INVOICE_PREFIX", ${settingId}, src."ORG_CURRENCY_ID",
          src."OA_ID", ${brand}, ${subject.userId}, 0, src."OA_BRAND_NM", src."OA_BRAND_CD", src."APPLICABLE_TAX", src."CST", src."PAN",
          ${subject.userId}, now(), ${subject.userId}, now()
        FROM org_acc_invoice_settings src WHERE src."ORG_ACC_INVOICE_SETTING_ID" = ${sourceId}`;
    }
    return { message: 'Successfully Synced Setting' };
  },
};
