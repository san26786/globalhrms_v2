import { z } from 'zod';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { ValidationError } from '@/lib/http/errors';
import { getMasterId, getMasterOptionsByTypeCode } from '@/lib/masters/masterService';
import { prisma } from '@/lib/prisma';
import { menuPolicy } from '@/lib/resource/policies';
import { PrismaModuleSettingsRepository } from '@/lib/settingManager/moduleSettings.repository';
import { activeBrand, authorize, brandOrgId, mastersOfTypeCode, type IdLabel } from '@/lib/systmMngt/shared';
import { vatFieldsFor, type VatOptions, type VatRegistrationModel, type VatValues } from './vatRules';

/**
 * CI vat_registration_settings/vat_registration_settings (Advance Settings → "VAT Registration
 * Settings"): one vat_registration_settings record per brand — add when the brand has none, otherwise
 * edit it. Which fields apply depends on the VAT status (CI form script + setFormControls):
 *   Registration Applied For (VARGSTRAF) → effective date only
 *   Registered (VARGSTR)                 → number, dates, return frequency, accounting basis, …
 *   De-registered (VARGSTDR)             → as Registered, plus the de-registration date
 *   Not Registered (VARGSTNR)            → nothing else
 * A brand admin's save also stores the brand settings SSAFVATRN (return frequency) and SSAFVRED (start
 * of the first VAT return period), which the VAT return screens read.
 *
 * Behaviour changes: the record is always the active brand's (CI took org / brand from posted hidden
 * fields for the super admin); the de-registration date is saved (CI's switch fell through and cleared
 * it); "Trade in EU" is only offered where it is saved; option values must be one of the listed
 * options; the period start is computed by whole months (PHP's "-3 months" overflowed on 30/31-day
 * months, e.g. a quarter ending 30 June started on 1 March).
 * Raw SQL: UPDATED_ON is NOT NULL in PostgreSQL, CI left it unset on insert.
 */

const MENU = 'vat_registration_settings/vat_registration_settings';

/** CI setting_group_attribute_value_mst_m::getValuesByAnswerGroupId(1426) — "Default VAT Return Frequency". */
const RETURN_FREQUENCY_ANSWER_GROUP = 1426;
/** Return frequency option id → months in one return period (CI's four cases; Daily / Weekly have none). */
const PERIOD_MONTHS: Record<number, number> = { 3859: 1, 3860: 3, 5267: 6, 3862: 12 };

interface Row {
  VRS_ID: number;
  VAT_CODE: string | null;
  REGISTRATION_NO: string | null;
  TRADE_IN_EU: number;
  REGISTER_EFFECTIVE_DATE: string | null;
  FIRST_VAT_RETURN: string | null;
  DEREGISTER_EFFECTIVE_DATE: string | null;
  RETURN_FREQUENCY: number | null;
  ACCOUNTING_BASIS: number | null;
  IS_FLAT_RATE: number;
  FLAT_RATE_SCHEME: number | null;
  INC_PRE_REG_EXPENESES: number | null;
}

/** CI vatSettingsForBrand(): the brand's first active record. */
async function brandRecord(brand: number): Promise<Row | null> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT v."VRS_ID",
           (SELECT im."MSTR_CD" FROM independent_mst im WHERE im."MSTR_ID" = v."VAT_REGISTERED" ORDER BY im."MSTR_ID" LIMIT 1) AS "VAT_CODE",
           v."REGISTRATION_NO", v."TRADE_IN_EU",
           to_char(v."REGISTER_EFFECTIVE_DATE", 'YYYY-MM-DD') AS "REGISTER_EFFECTIVE_DATE",
           to_char(v."FIRST_VAT_RETURN", 'YYYY-MM-DD') AS "FIRST_VAT_RETURN",
           to_char(v."DEREGISTER_EFFECTIVE_DATE", 'YYYY-MM-DD') AS "DEREGISTER_EFFECTIVE_DATE",
           v."RETURN_FREQUENCY", v."ACCOUNTING_BASIS", v."IS_FLAT_RATE", v."FLAT_RATE_SCHEME", v."INC_PRE_REG_EXPENESES"
    FROM vat_registration_settings v
    WHERE v."OA_BRAND_ID" = ${brand} AND v."IS_DELETED" = 0
    ORDER BY v."VRS_ID" LIMIT 1`;
  return rows[0] ?? null;
}

async function returnFrequencies(): Promise<IdLabel[]> {
  const rows = await prisma.$queryRaw<Array<{ value: number; label: string | null }>>`
    SELECT v."SETTING_ATTRIBUTE_OPTIONS_ID" AS value,
           COALESCE((SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = v."SYSTEM_SETTING_ATTRIBUTE_VALUE_ID" ORDER BY im."MSTR_ID" LIMIT 1),
                    v."INPUT_OPTION_DESC") AS label
    FROM "setting_group_attribute_Value_mst" v
    WHERE v."ANSWER_GROUP_ID" = ${RETURN_FREQUENCY_ANSWER_GROUP} AND v."IS_DELETED" = 0
    ORDER BY v."SETTING_ATTRIBUTE_OPTIONS_ID"`;
  return rows.map((r) => ({ value: Number(r.value), label: (r.label ?? '').trim() }));
}

async function loadOptions(): Promise<VatOptions> {
  const [statuses, frequencies, accountingBases, preRegExpenses, flatRateSchemes] = await Promise.all([
    getMasterOptionsByTypeCode('VATREGST'),
    returnFrequencies(),
    mastersOfTypeCode('VATACCBS'),
    mastersOfTypeCode('VATPREREG'),
    mastersOfTypeCode('FRS'),
  ]);
  return {
    // CI posted the status CODE (VARGSTNR exists as three master rows); the code is what the form keys on.
    statuses: statuses.flatMap((o) => (o.code ? [{ value: o.code, label: o.label }] : [])),
    returnFrequencies: frequencies,
    accountingBases,
    preRegExpenses,
    flatRateSchemes,
  };
}

const s = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v));
const flag = (v: unknown) => v === true || v === 1 || v === '1' || v === 'on';
const trimmed = z.preprocess((v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v)), z.string());

const bodySchema = z.object({
  vat_registered: trimmed,
  registration_no: trimmed,
  trade_in_eu: z.preprocess(flag, z.boolean()),
  register_effective_date: trimmed,
  first_vat_return: trimmed,
  deregister_effective_date: trimmed,
  return_frequency: trimmed,
  accounting_basis: trimmed,
  is_flat_rate: z.preprocess(flag, z.boolean()),
  flat_rate_scheme: trimmed,
  inc_pre_reg_expeneses: trimmed,
});

/** CI setFormValidationRules + "must be one of the options" for every dropdown. */
function parseSave(body: unknown, options: VatOptions): z.infer<typeof bodySchema> {
  const v = bodySchema.parse(body);
  const errors: Record<string, string[]> = {};
  const need = (field: keyof VatValues, label: string) => {
    if (!v[field]) errors[field] = [`The ${label} field is required.`];
  };
  const oneOf = (field: keyof VatValues, label: string, list: Array<{ value: number | string }>) => {
    if (v[field] && !list.some((o) => String(o.value) === v[field])) errors[field] = [`Select a valid ${label}.`];
  };
  const date = (field: keyof VatValues, label: string) => {
    const value = v[field] as string;
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)))) {
      errors[field] = [`The ${label} field must be a valid date.`];
    }
  };

  need('vat_registered', 'VAT Registered');
  oneOf('vat_registered', 'VAT Registered', options.statuses);
  const apply = vatFieldsFor(v.vat_registered);
  if (apply.effectiveDate) {
    need('register_effective_date', 'Effective Date of VAT Registration');
    date('register_effective_date', 'Effective Date of VAT Registration');
  }
  if (apply.deregisterDate) {
    need('deregister_effective_date', 'Deregisteration Effective Date');
    date('deregister_effective_date', 'Deregisteration Effective Date');
  }
  if (apply.registration) {
    need('registration_no', 'VAT Registration No');
    if (v.registration_no.length > 20) errors.registration_no = ['The VAT Registration No field cannot exceed 20 characters.'];
    need('first_vat_return', 'First Vat Return Period End Date');
    date('first_vat_return', 'First Vat Return Period End Date');
    need('return_frequency', 'Default VAT Return Frequency');
    oneOf('return_frequency', 'Default VAT Return Frequency', options.returnFrequencies);
    need('accounting_basis', 'Accounting Basis');
    oneOf('accounting_basis', 'Accounting Basis', options.accountingBases);
    need('inc_pre_reg_expeneses', 'Include Pre Registration Expenses');
    oneOf('inc_pre_reg_expeneses', 'Include Pre Registration Expenses', options.preRegExpenses);
    if (v.is_flat_rate) {
      need('flat_rate_scheme', 'Flat Rate Scheme');
      oneOf('flat_rate_scheme', 'Flat Rate Scheme', options.flatRateSchemes);
    }
  }
  if (Object.keys(errors).length) throw new ValidationError('Validation failed.', errors);
  return v;
}

/** CI setting_group_attribute_mst_m::getAttributeIDByCode(code): SETTING_ATTRIBUTE_ID per attribute code. */
async function settingAttributeIds(codes: string[]): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<Array<{ code: string; id: number }>>`
    SELECT DISTINCT ON ("SYSTEM_SETTING_ATTRIBUTE_CD") "SYSTEM_SETTING_ATTRIBUTE_CD" AS code, "SETTING_ATTRIBUTE_ID" AS id
    FROM setting_group_attribute_mst
    WHERE "SYSTEM_SETTING_ATTRIBUTE_CD" = ANY(${codes}::text[]) AND COALESCE("IS_DELETED", 0) = 0
    ORDER BY "SYSTEM_SETTING_ATTRIBUTE_CD", "SETTING_ATTRIBUTE_ID"`;
  return new Map(rows.map((r) => [r.code, Number(r.id)]));
}

/**
 * First day of the first VAT return period (CI SSAFVRED): the period ends with the month of
 * `periodEnd` and is `months` long. '' when the frequency has no period (Daily / Weekly) or no date.
 */
export function firstPeriodStart(periodEnd: string | null, frequencyId: number | null): string {
  const months = frequencyId ? PERIOD_MONTHS[frequencyId] : undefined;
  if (!periodEnd || !months) return '';
  const [y, m] = periodEnd.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1 - (months - 1), 1));
  return start.toISOString().slice(0, 10);
}

export const vatRegistrationSettingsService = {
  async load(subject: RequestSubject): Promise<VatRegistrationModel> {
    await authorize(subject, MENU, 'list');
    const brand = activeBrand(subject);
    const [record, options] = await Promise.all([brandRecord(brand), loadOptions()]);
    const canSave = await menuPolicy(MENU).check(subject, record ? 'update' : 'create');
    return {
      title: record ? 'Edit VAT Registration Settings' : 'New VAT Registration Settings',
      mode: record ? 'edit' : 'add',
      values: {
        vat_registered: s(record?.VAT_CODE),
        registration_no: s(record?.REGISTRATION_NO),
        trade_in_eu: record?.TRADE_IN_EU === 1,
        register_effective_date: s(record?.REGISTER_EFFECTIVE_DATE),
        first_vat_return: s(record?.FIRST_VAT_RETURN),
        deregister_effective_date: s(record?.DEREGISTER_EFFECTIVE_DATE),
        return_frequency: s(record?.RETURN_FREQUENCY),
        accounting_basis: s(record?.ACCOUNTING_BASIS),
        is_flat_rate: record?.IS_FLAT_RATE === 1,
        flat_rate_scheme: s(record?.FLAT_RATE_SCHEME),
        inc_pre_reg_expeneses: s(record?.INC_PRE_REG_EXPENESES),
      },
      options,
      canSave,
    };
  },

  /** CI insert() / update() → vat_registration_settings_m, then (brand admin) the two brand settings. */
  async save(subject: RequestSubject, body: unknown): Promise<{ message: string }> {
    const brand = activeBrand(subject);
    const record = await brandRecord(brand);
    await authorize(subject, MENU, record ? 'update' : 'create');
    const v = parseSave(body, await loadOptions());
    const apply = vatFieldsFor(v.vat_registered);

    const statusId = await getMasterId(v.vat_registered);
    const num = (x: string) => (x === '' ? null : Number(x));
    const day = (x: string) => (x === '' ? null : new Date(`${x}T00:00:00Z`));
    const c = {
      registrationNo: apply.registration ? v.registration_no : null,
      tradeInEu: apply.registration && v.trade_in_eu ? 1 : 0,
      effectiveDate: apply.effectiveDate ? day(v.register_effective_date) : null,
      firstReturn: apply.registration ? day(v.first_vat_return) : null,
      deregisterDate: apply.deregisterDate ? day(v.deregister_effective_date) : null,
      frequency: apply.registration ? num(v.return_frequency) : null,
      basis: apply.registration ? num(v.accounting_basis) : null,
      isFlatRate: apply.registration && v.is_flat_rate ? 1 : 0,
      flatRateScheme: apply.registration && v.is_flat_rate ? num(v.flat_rate_scheme) : null,
      preRegExpenses: apply.registration ? num(v.inc_pre_reg_expeneses) : null,
    };

    let message: string;
    if (record) {
      await prisma.$executeRaw`
        UPDATE vat_registration_settings SET
          "VAT_REGISTERED" = ${statusId}, "REGISTRATION_NO" = ${c.registrationNo}, "TRADE_IN_EU" = ${c.tradeInEu},
          "REGISTER_EFFECTIVE_DATE" = ${c.effectiveDate}::date, "FIRST_VAT_RETURN" = ${c.firstReturn}::date,
          "DEREGISTER_EFFECTIVE_DATE" = ${c.deregisterDate}::date, "RETURN_FREQUENCY" = ${c.frequency},
          "ACCOUNTING_BASIS" = ${c.basis}, "IS_FLAT_RATE" = ${c.isFlatRate}, "FLAT_RATE_SCHEME" = ${c.flatRateScheme},
          "INC_PRE_REG_EXPENESES" = ${c.preRegExpenses}, "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now()
        WHERE "VRS_ID" = ${record.VRS_ID} AND "OA_BRAND_ID" = ${brand}`;
      message = 'Successfully Updated';
    } else {
      await assertInsertSafe('vat_registration_settings', 'VRS_ID');
      const oaId = await brandOrgId(brand, subject.oaId);
      await prisma.$executeRaw`
        INSERT INTO vat_registration_settings (
          "VAT_REGISTERED", "REGISTRATION_NO", "TRADE_IN_EU", "REGISTER_EFFECTIVE_DATE", "FIRST_VAT_RETURN",
          "DEREGISTER_EFFECTIVE_DATE", "RETURN_FREQUENCY", "ACCOUNTING_BASIS", "IS_FLAT_RATE", "FLAT_RATE_SCHEME",
          "INC_PRE_REG_EXPENESES", "IS_DELETED", "OA_ID", "OA_BRAND_ID", "USER_ID", "CREATED_BY", "CREATED_ON", "UPDATED_ON")
        VALUES (
          ${statusId}, ${c.registrationNo}, ${c.tradeInEu}, ${c.effectiveDate}::date, ${c.firstReturn}::date,
          ${c.deregisterDate}::date, ${c.frequency}, ${c.basis}, ${c.isFlatRate}, ${c.flatRateScheme},
          ${c.preRegExpenses}, 0, ${oaId}, ${brand}, ${subject.userId}, ${subject.userId}, now(), now())`;
      message = 'Successfully Added';
    }

    // CI: is_admin == 1 → oa_brand_setting_attribute_mst_m::upsert(SSAFVRED, SSAFVATRN).
    if (subject.adminLevel === 1) {
      const ids = await settingAttributeIds(['SSAFVRED', 'SSAFVATRN']);
      const answers = [
        { code: 'SSAFVRED', value: firstPeriodStart(apply.registration ? v.first_vat_return : null, c.frequency) },
        { code: 'SSAFVATRN', value: c.frequency === null ? '' : String(c.frequency) },
      ].flatMap((a) => (ids.has(a.code) ? [{ attributeId: ids.get(a.code)!, value: a.value }] : []));
      await new PrismaModuleSettingsRepository().saveAnswers({
        oaId: await brandOrgId(brand, subject.oaId),
        oaBrandId: brand,
        userId: subject.userId,
        answers,
        codeWrites: [],
      });
    }
    return { message };
  },
};
