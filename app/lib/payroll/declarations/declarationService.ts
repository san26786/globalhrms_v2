import type { RequestSubject } from '@/lib/auth/getSubject';
import { SqlBuilder } from '@/lib/employeeMngt/empList';
import { Checks, columnsOf, fullName, insertRow, scopeSql, updateRow, type DbValue, type Tx } from '@/lib/employeeMngt/hub/hubEngine';
import { keepCurrent, mastersByCode, periodLabel } from '@/lib/employeeMngt/hub/hubOptions';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/http/errors';
import { getMasterId } from '@/lib/masters/masterService';
import { prisma } from '@/lib/prisma';
import { menuPolicy } from '@/lib/resource/policies';
import { parseId, type IdLabel } from '@/lib/systmMngt/shared';
import { reportFinancialYears } from '../reports/periods';
import { checkUpload, detachSlotFiles, findSlotFiles, readDeclarationFile, storeSlotFile, type Slot } from './declarationFiles';
import { SECTION_CODES, isSectionCode, type DeclarationOptions as Options, type DeclarationPage, type MedicalRow, type SaveResult, type SectionCode } from './declarationTypes';
import { brandCountry, cappedBenefit, limitBenefit, matchingRule, maximumLimits, type RuleScope } from './rules';
import { employeeTaxFigures, loadTaxYear } from './taxSummary';

/**
 * CI employeeMngt/emp_investment_declarations ("Investment Declaration", reached from Investment Details by "Save And
 * Next"): an employee's India tax declaration for the financial year of an investment_mst_declaration header, in nine
 * IT-Act sections, each saved, reset and (four of them) given a picture:
 *   IPCCD 80G donations (donations_details)        IPCTN 80CCD(1B) NPS (emp_nps)
 *   IPME 80D medical expenses, one row per dependent (medical_expenses_details)
 *   DDTYPE 80DD dependent with disability (dependent_disability)   SEC80 80U disabled employee (disability_emp)
 *   IPEE 80E education loan interest (education_loan_details)
 *   IPIITS 80C tax-saving instruments by sub-section (emp_tax_savings + emp_sub_section_details)
 *   IPOAH 24b home loan interest (emp_home_loan_details)   IPRE 10(13A) rent / HRA (emp_hra_details)
 * Each section stores the declared amount and its benefit (rules.ts), and every save or reset rolls the sections up
 * into the header (rollUp): TOTAL_INVESTMENT_AMOUNT = the declared amounts (80U has none), ACTUAL_AMOUNT = the
 * benefits — the amount payroll's TDS takes off the old regime's taxable income (run/writer.ts).
 *
 * Who: the Investment Details menu grant (employeeMngt/emp_investments) on a header in the caller's scope (super
 * admin: every brand; brand admin: the brand; a normal user: their own employee's) — view with the list grant,
 * change with the add or edit grant.
 *
 * Behaviour changes (CI's controller checked nothing — any user could post any declaration id): the scope and grants
 * above; amounts are validated (numbers ≥ 0, whole rupees where the column is whole, at most 99,99,999), the select
 * that decides a section's limit is required once an amount is declared (CI let a section be saved without it and
 * gave no benefit); rows are soft-deleted (CI deleted them) and the roll-up reads live rows; a reset recomputes the
 * header (CI's donations reset did not); a section's first save writes one row (CI's HRA wrote two, the first
 * without its exemption, so the header missed the HRA benefit); an 80C sub-section set back to 0 is saved as 0 (CI
 * skipped it and kept the old amount); the HRA exemption is never negative (CI stored rent − 10 % of basic when below
 * zero); a Medical Expenses save updates its rows in place (CI deleted all rows first and re-inserted them).
 * Schema gaps (no schema changes in this migration): medical_expenses_details has no INVESTMENT_NAME column, so the
 * dependent name is offered only once that column exists; files of tables without an ATTACHMENT column are kept by
 * name (declarationFiles.ts).
 */
const MENU = 'employeeMngt/emp_investments';
const MAX_AMOUNT = 9_999_999.99;
const MAX_MEDICAL_ROWS = 20;
const LIVE = 'COALESCE(t."IS_DELETED", 0) = 0';

/** Section tables: primary key and whether INVESTMENT_ID is text (donations_details / emp_nps). */
const TABLES: Record<SectionCode, { table: string; pk: string; text: boolean }> = {
  IPCCD: { table: 'donations_details', pk: 'EL_ID', text: true },
  IPCTN: { table: 'emp_nps', pk: 'EL_ID', text: true },
  IPME: { table: 'medical_expenses_details', pk: 'EL_ID', text: false },
  DDTYPE: { table: 'dependent_disability', pk: 'EL_ID', text: false },
  SEC80: { table: 'disability_emp', pk: 'EL_ID', text: false },
  IPEE: { table: 'education_loan_details', pk: 'EL_ID', text: false },
  IPIITS: { table: 'emp_tax_savings', pk: 'ID', text: false },
  IPOAH: { table: 'emp_home_loan_details', pk: 'ID', text: false },
  IPRE: { table: 'emp_hra_details', pk: 'ID', text: false },
};

/** The sections with a picture and their file slot. */
const SLOTS: Partial<Record<SectionCode, Slot>> = { IPCCD: 'don', IPCTN: 'nps', DDTYPE: 'dd', SEC80: 'dis' };

const MESSAGES: Record<SectionCode, string> = {
  IPCCD: 'Updated Donations Declaration',
  IPCTN: 'Updated Contribution to NPS',
  IPME: 'Updated Medical Expenses Declaration',
  DDTYPE: 'Updated Dependent & Disability Declaration',
  SEC80: 'Updated Disable Employee Declaration',
  IPEE: 'Updated Education Loan Declaration',
  IPIITS: 'Updated Investments in Tax-Saving Instruments',
  IPOAH: 'Updated Home Loan Benefit',
  IPRE: 'Updated HRA Benefit',
};

export interface Header {
  id: number;
  empId: number;
  fyId: number;
  brand: number;
  oaId: number | null;
  userId: number | null;
  empCode: string | null;
  empName: string;
  fyName: string | null;
  investment: string;
  benefit: string;
}

const text = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
const money = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const fixed = (n: number, scale: number) => (Math.round(n * 10 ** scale) / 10 ** scale).toFixed(scale);

// ------------------------------------------------------------------ access

async function canEdit(subject: RequestSubject): Promise<boolean> {
  const policy = menuPolicy(MENU);
  return (await policy.check(subject, 'create')) || (await policy.check(subject, 'update'));
}

/** The declaration header, if it is live and in the caller's scope; `edit` also needs the add or edit grant. */
export async function loadHeader(subject: RequestSubject, rawId: string | number, mode: 'view' | 'edit'): Promise<Header> {
  const id = parseId(rawId);
  if (!(await menuPolicy(MENU).check(subject, 'list'))) throw new ForbiddenError();
  if (mode === 'edit' && !(await canEdit(subject))) throw new ForbiddenError();
  const sql = new SqlBuilder();
  const scope = await scopeSql(subject, sql);
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT h."ID" AS id, h."EMP_ID" AS emp, h."FY_ID" AS fy, COALESCE(h."OA_BRAND_ID", em."OA_BRAND_ID") AS brand,
       COALESCE(h."OA_ID", em."OA_ID") AS oa, COALESCE(h."USER_ID", em."REF_EMP_ID") AS "user", em."EMP_NBR" AS code, ${fullName('em')} AS name,
       (SELECT p."FISCAL_PERIOD_DESC" FROM period_mst p WHERE p."PERIOD_ID" = h."FY_ID" LIMIT 1) AS "fyName",
       h."TOTAL_INVESTMENT_AMOUNT"::text AS investment, h."ACTUAL_AMOUNT"::text AS benefit
     FROM investment_mst_declaration h JOIN emp_mst em ON em."EMP_ID" = h."EMP_ID"
     WHERE h."ID" = ${sql.p(id)}::int AND h."IS_DELETED" = 0 AND em."IS_DELETED" = 0 AND ${scope} LIMIT 1`,
    ...sql.params,
  );
  const r = rows[0];
  if (!r) throw new NotFoundError('Record not found.');
  const n = (v: unknown) => (v === null || v === undefined || Number(v) === 0 ? null : Number(v));
  return {
    id: Number(r.id), empId: Number(r.emp), fyId: Number(r.fy), brand: Number(r.brand), oaId: n(r.oa), userId: n(r.user),
    empCode: r.code ? String(r.code) : null, empName: String(r.name ?? ''), fyName: r.fyName ? String(r.fyName) : null,
    investment: String(r.investment ?? '0'), benefit: String(r.benefit ?? '0'),
  };
}

// ------------------------------------------------------------------ rows

const matchId = (code: SectionCode, param: string) =>
  TABLES[code].text ? `btrim(t."INVESTMENT_ID") = ${param}::text` : `t."INVESTMENT_ID" = ${param}::int`;
const idParam = (code: SectionCode, id: number) => (TABLES[code].text ? String(id) : id);

/** The section's live rows of the declaration, oldest first (CI read the first: row()). */
async function liveRows(db: Tx, code: SectionCode, id: number): Promise<Array<Record<string, unknown>>> {
  const { table, pk } = TABLES[code];
  return db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT t.* FROM ${table} t WHERE ${matchId(code, '$1')} AND ${LIVE} ORDER BY t."${pk}"`,
    idParam(code, id),
  );
}

const ownership = (h: Header): Record<string, DbValue> => ({ OA_ID: h.oaId, OA_BRAND_ID: h.brand, USER_ID: h.userId });

/** CI upsert*: update the declaration's rows of the section (CI: every row of the investment), else add one. */
async function upsertSingle(tx: Tx, code: SectionCode, h: Header, data: Record<string, DbValue>, onInsert: Record<string, DbValue>, actor: number) {
  const { table, pk } = TABLES[code];
  const rows = await liveRows(tx, code, h.id);
  if (rows.length) {
    for (const r of rows) await updateRow(tx, table, pk, Number(r[pk]), data, actor);
    return;
  }
  await insertRow(tx, table, pk, { ...onInsert, ...data, ...ownership(h), INVESTMENT_ID: idParam(code, h.id) }, actor);
}

async function softDelete(tx: Tx, table: string, pk: string, ids: number[], actor: number) {
  for (const rowId of ids) await updateRow(tx, table, pk, rowId, { IS_DELETED: 1 }, actor);
}

/** The roll-up's two sums (CI calculateTotalInvestment) over the live rows; `$1` is the declaration id. */
const ROLL_UP = (() => {
  const first = (table: string, pk: string, col: string, isText = false) =>
    `COALESCE((SELECT t."${col}" FROM ${table} t WHERE ${isText ? 'btrim(t."INVESTMENT_ID") = $1::text' : 't."INVESTMENT_ID" = $1::int'} AND ${LIVE} ORDER BY t."${pk}" LIMIT 1), 0)`;
  const sum = (col: string) => `COALESCE((SELECT sum(t."${col}") FROM medical_expenses_details t WHERE t."INVESTMENT_ID" = $1::int AND ${LIVE}), 0)`;
  const investment = [
    first('education_loan_details', 'EL_ID', 'INTEREST_PAID'), first('emp_tax_savings', 'ID', 'INVESTMENT_AMOUNT'),
    first('emp_home_loan_details', 'ID', 'LOAN_AMOUNT'), first('emp_hra_details', 'ID', 'RENT_AMOUNT'),
    first('donations_details', 'EL_ID', 'INVESTMENT_AMT', true), sum('INVESTMENT_AMT'),
    first('dependent_disability', 'EL_ID', 'INVESTMENT_AMT'), first('emp_nps', 'EL_ID', 'INVESTMENT_AMT', true),
  ].join(' + ');
  const benefit = [
    first('education_loan_details', 'EL_ID', 'ACTUAL_AMOUNT'), first('emp_tax_savings', 'ID', 'ACTUAL_AMOUNT'),
    first('emp_home_loan_details', 'ID', 'ACTUAL_AMOUNT'), first('emp_hra_details', 'ID', 'ACTUAL_AMOUNT'),
    first('donations_details', 'EL_ID', 'ACTUAL_AMOUNT', true), sum('ACTUAL_AMOUNT'),
    first('dependent_disability', 'EL_ID', 'ACTUAL_AMOUNT'), first('disability_emp', 'EL_ID', 'ACTUAL_AMOUNT'),
    first('emp_nps', 'EL_ID', 'ACTUAL_AMOUNT', true),
  ].join(' + ');
  return { investment, benefit };
})();

/** What the roll-up would store for the declaration (read-only). */
export async function rollUpTotals(db: Tx, id: number): Promise<{ investment: string; benefit: string }> {
  const [r] = await db.$queryRawUnsafe<Array<{ investment: string; benefit: string }>>(
    `SELECT (${ROLL_UP.investment})::numeric(10,2)::text AS investment, (${ROLL_UP.benefit})::numeric(10,2)::text AS benefit`,
    String(id),
  );
  return r;
}

/** CI calculateTotalInvestment: the header's TOTAL_INVESTMENT_AMOUNT and ACTUAL_AMOUNT from its sections. */
export async function rollUp(tx: Tx, id: number, actor: number): Promise<{ investment: string; benefit: string }> {
  const [r] = await tx.$queryRawUnsafe<Array<{ investment: string; benefit: string }>>(
    `UPDATE investment_mst_declaration SET "TOTAL_INVESTMENT_AMOUNT" = ${ROLL_UP.investment}, "ACTUAL_AMOUNT" = ${ROLL_UP.benefit},
       "UPDATED_BY" = $2::int, "UPDATED_ON" = to_char(now(), 'YYYY-MM-DD HH24:MI:SS')::timestamp
     WHERE "ID" = $1::int RETURNING "TOTAL_INVESTMENT_AMOUNT"::text AS investment, "ACTUAL_AMOUNT"::text AS benefit`,
    String(id), actor,
  );
  return r;
}

// ------------------------------------------------------------------ inputs

/** A declared amount: '' is 0 (CI); whole rupees where the column is an integer. */
function amountOf(raw: unknown, field: string, label: string, check: Checks, whole: boolean): number {
  const v = text(raw).replace(/,/g, '');
  if (v === '') return 0;
  if (!(whole ? /^\d+$/ : /^\d+(\.\d{1,2})?$/).test(v)) {
    check.fail(field, whole ? `The ${label} field must be a whole number of rupees.` : `The ${label} field must be an amount with up to 2 decimals.`);
    return 0;
  }
  const n = Number(v);
  if (n > MAX_AMOUNT) check.fail(field, `The ${label} field cannot exceed 99,99,999.`);
  return n;
}

/** A dropdown value: '' or one of the options. */
function choiceOf(raw: unknown, options: IdLabel[], field: string, label: string, check: Checks, required: boolean): string {
  const v = text(raw);
  if (!v || v === '0') {
    if (required) check.fail(field, `The ${label} field is required.`);
    return '';
  }
  if (!options.some((o) => String(o.value) === v)) check.fail(field, `Select a valid ${label}.`);
  return v;
}

const flag = (raw: unknown) => ['1', 'true', 'on', 'yes'].includes(text(raw).toLowerCase());

// ------------------------------------------------------------------ options / page

async function optionsFor(h: Header, currentYear: unknown): Promise<Options> {
  const [payment, medicalType, age, dependentType, disabilityType, completionStatus, cityType, fys] = await Promise.all([
    mastersByCode('PAY'), mastersByCode('MED'), mastersByCode('AGE'), mastersByCode('TPE'), mastersByCode('DISTPE'),
    mastersByCode('COMST'), mastersByCode('CITYTP'), reportFinancialYears(h.brand),
  ]);
  // CI: every financial year (getAllPeriodDetails) — the year the interest was first paid may be closed.
  const years = await keepCurrent(fys.map((y) => ({ value: y.id, label: y.name })), currentYear, periodLabel);
  return { payment, medicalType, age, dependentType, disabilityType, completionStatus, cityType, years: years as IdLabel[] };
}

/** CI getdependentdropdown — the employee's dependents (CI listed every employee's: dependent_dtl_vw unfiltered). */
async function dependentsOf(empId: number): Promise<IdLabel[]> {
  const rows = await prisma.$queryRaw<Array<{ value: number; label: string | null }>>`
    SELECT d."DEPENDENT_DTL_ID" AS value, btrim(concat_ws(' ', cm."CNTCT_FRST_NM", cm."CNTCT_LST_NM")) AS label
    FROM dependent_dtl d
    LEFT JOIN oa_contacts oc ON oc."OA_CNTCTS_ID" = d."OA_DEP_CNTCTS_ID"
    LEFT JOIN contact_mst cm ON cm."CNTCT_ID" = oc."CNTCT_ID"
    WHERE d."EMP_ID" = ${empId} AND d."IS_DELETED" = 0
    ORDER BY 2, 1`;
  return rows.map((r) => ({ value: Number(r.value), label: r.label || `Dependent #${r.value}` }));
}

/** EMPIAP section masters (CI getAllIndMstDetailsByTypeCode: SEQUENCE, MSTR_NM). */
async function sectionMasters(): Promise<Array<{ id: number; code: string; name: string; description: string }>> {
  const rows = await prisma.$queryRaw<Array<{ id: number; code: string; name: string; description: string | null }>>`
    SELECT DISTINCT ON (im."SEQUENCE", im."MSTR_NM", im."MSTR_CD") im."MSTR_ID" AS id, im."MSTR_CD" AS code, im."MSTR_NM" AS name, im."MSTR_DESC" AS description
    FROM independent_mst im JOIN common_type ct ON ct."TYP_ID" = im."TYP_ID"
    WHERE ct."TYP_CD" = 'EMPIAP' AND COALESCE(im."IS_DELETED", false) = false
    ORDER BY im."SEQUENCE", im."MSTR_NM", im."MSTR_CD", im."MSTR_ID"`;
  const seen = new Set<string>();
  return rows
    .filter((r) => (seen.has(r.code) ? false : (seen.add(r.code), true)))
    .map((r) => ({ id: Number(r.id), code: r.code, name: r.name, description: r.description ?? '' }));
}

/** CI getTaxSavingsInstruments: the 80C groups (SCSUT) and their sub-sections (sub_section_mapping → SCSTDS). */
async function subSections(): Promise<Array<{ id: number; name: string; items: Array<{ id: number; code: string; name: string }> }>> {
  const [groups, items] = await Promise.all([
    mastersByCode('SCSUT'),
    prisma.$queryRaw<Array<{ group: number; id: number; code: string; name: string }>>`
      SELECT ssm."SECTION_TYPE" AS "group", im."MSTR_ID" AS id, im."MSTR_CD" AS code, im."MSTR_NM" AS name
      FROM sub_section_mapping ssm JOIN independent_mst im ON im."MSTR_ID" = ssm."SECTION_DESCRIPTION"
      WHERE ssm."IS_DELETED" = 0 ORDER BY ssm."ID"`,
  ]);
  return groups.map((g) => ({
    id: g.value,
    name: g.label,
    items: items.filter((i) => Number(i.group) === g.value).map((i) => ({ id: Number(i.id), code: i.code, name: i.name })),
  }));
}

async function hasColumn(table: string, column: string): Promise<boolean> {
  return (await columnsOf(table)).has(column);
}

const idText = (v: unknown) => (v === null || v === undefined || text(v) === '0' ? '' : text(v));

/**
 * The pictures by slot (don / nps / dd / dis / med{row}): the section row's ATTACHMENT when its table has the column
 * and it is set (CI's names), else the newest file stored under the slot's name.
 */
async function attachmentsOf(id: number, rows: Record<SectionCode, Array<Record<string, unknown>>>): Promise<Record<string, string | null>> {
  const medicalSlots = rows.IPME.map((r) => `med${Number(r.EL_ID)}` as Slot);
  const [stored, ...columns] = await Promise.all([
    findSlotFiles(id, [...Object.values(SLOTS), ...medicalSlots]),
    ...SECTION_CODES.map((c) => hasColumn(TABLES[c].table, 'ATTACHMENT')),
  ]);
  const hasAttachment = Object.fromEntries(SECTION_CODES.map((c, i) => [c, columns[i]])) as Record<SectionCode, boolean>;
  const out: Record<string, string | null> = {};
  const pick = (c: SectionCode, row: Record<string, unknown> | undefined, slot: Slot) => {
    out[slot] = (hasAttachment[c] && row && text(row.ATTACHMENT)) || stored[slot] || null;
  };
  for (const [c, slot] of Object.entries(SLOTS) as Array<[SectionCode, Slot]>) pick(c, rows[c][0], slot);
  rows.IPME.forEach((r, i) => pick('IPME', r, medicalSlots[i]));
  return out;
}

/** CI index(): everything the declaration page shows. */
export async function declarationPage(subject: RequestSubject, rawId: string): Promise<DeclarationPage> {
  const h = await loadHeader(subject, rawId, 'view');
  const scope: RuleScope = { brand: h.brand, country: await brandCountry(h.brand), fy: h.fyId };
  const all = await Promise.all(SECTION_CODES.map((c) => liveRows(prisma, c, h.id)));
  const rows = Object.fromEntries(SECTION_CODES.map((c, i) => [c, all[i]])) as Record<SectionCode, Array<Record<string, unknown>>>;
  const first = (c: SectionCode) => rows[c][0] ?? null;

  const [masters, limits, groups, editable, medicalNameColumn, files] = await Promise.all([
    sectionMasters(),
    maximumLimits(scope),
    subSections(),
    canEdit(subject),
    hasColumn('medical_expenses_details', 'INVESTMENT_NAME'),
    attachmentsOf(h.id, rows),
  ]);
  const [options, dependents] = await Promise.all([optionsFor(h, first('IPEE')?.YEAR), dependentsOf(h.empId)]);

  // 80C sub-section amounts (CI getSubSectionAmount: the declaration's detail row of the sub-section).
  const ts = first('IPIITS');
  const details = ts
    ? await prisma.$queryRaw<Array<{ sub: number; amount: string }>>`
        SELECT d."SUB_SECTION_ID" AS sub, d."INVESTMENT_AMOUNT"::text AS amount FROM emp_sub_section_details d
        WHERE d."TAX_SAVINGS_ID" = ${Number(ts.ID)} AND COALESCE(d."IS_DELETED", 0) = 0 ORDER BY d."ID"`
    : [];
  const subAmount = new Map<number, string>();
  for (const d of details) if (!subAmount.has(Number(d.sub))) subAmount.set(Number(d.sub), d.amount);

  const medicalRows: MedicalRow[] = rows.IPME.map((r) => ({
    id: Number(r.EL_ID),
    dependent: medicalNameColumn ? idText(r.INVESTMENT_NAME) : '',
    type: idText(r.INVESTMENT_TYPE),
    age: idText(r.AGE),
    amount: text(r.INVESTMENT_AMT),
    benefit: text(r.ACTUAL_AMOUNT) || '0',
    attachment: files[`med${Number(r.EL_ID)}`] ?? null,
  }));

  // CI dataval: the amount shown on each section's card.
  const medicalTotal = rows.IPME.reduce((s, r) => s + money(r.INVESTMENT_AMT), 0);
  const amounts: Record<string, string> = {
    IPEE: text(first('IPEE')?.INTEREST_PAID) || '0',
    IPOAH: text(first('IPOAH')?.LOAN_AMOUNT) || '0',
    IPIITS: text(ts?.INVESTMENT_AMOUNT) || '0',
    IPRE: text(first('IPRE')?.RENT_AMOUNT) || '0',
    IPME: String(medicalTotal),
    DDTYPE: text(first('DDTYPE')?.INVESTMENT_AMT) || '0',
    IPCCD: text(first('IPCCD')?.INVESTMENT_AMT) || '0',
    IPCTN: text(first('IPCTN')?.INVESTMENT_AMT) || '0',
    SEC80: text(first('SEC80')?.ACTUAL_AMOUNT) || '0',
  };

  const notices: string[] = [];
  const [dup] = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT "ID" AS id FROM investment_mst_declaration WHERE "EMP_ID" = ${h.empId} AND "FY_ID" = ${h.fyId} AND "IS_DELETED" = 0 ORDER BY "ID" LIMIT 1`;
  if (dup && Number(dup.id) !== h.id) {
    notices.push(`The employee has another Investment Details record for this financial year (#${dup.id}); payroll's income tax uses that one.`);
  }
  const storageConfigured = !!process.env.DECLARATION_ATTACHMENT_DIR?.trim();
  if (!storageConfigured) notices.push('Attachments cannot be uploaded: DECLARATION_ATTACHMENT_DIR is not set on the server.');

  const summary = await summaryFor(h);
  if (summary.regime === 'new') notices.push('The employee is on the new tax regime: payroll does not deduct these investments from taxable income.');

  return {
    header: {
      id: h.id,
      employee: { id: h.empId, code: h.empCode, name: h.empName },
      fy: { id: h.fyId, name: h.fyName },
      totals: { investment: h.investment, benefit: h.benefit },
    },
    canEdit: editable,
    summary,
    sections: masters.map((m) => ({
      code: m.code,
      name: m.name,
      description: m.description,
      maxBenefit: limits[m.code] ?? null,
      amount: amounts[m.code] ?? '0',
      form: isSectionCode(m.code),
    })),
    options: { ...options, dependents },
    data: {
      IPCCD: { payment: idText(first('IPCCD')?.PAYMENT), amount: amounts.IPCCD, attachment: files.don ?? null },
      IPCTN: { amount: amounts.IPCTN, attachment: files.nps ?? null },
      IPME: { rows: medicalRows, dependentColumn: medicalNameColumn },
      DDTYPE: { type: idText(first('DDTYPE')?.INVESTMENT_TPE), amount: amounts.DDTYPE, attachment: files.dd ?? null },
      SEC80: { type: idText(first('SEC80')?.DIS_TYPE), benefit: amounts.SEC80, attachment: files.dis ?? null },
      IPEE: { interest: first('IPEE') ? amounts.IPEE : '', year: idText(first('IPEE')?.YEAR) },
      IPIITS: {
        total: amounts.IPIITS,
        groups: groups.map((g) => ({ ...g, items: g.items.map((i) => ({ ...i, amount: subAmount.get(i.id) ?? '0' })) })),
      },
      IPOAH: {
        selfOccupied: Number(first('IPOAH')?.SELF_OCCUPIED ?? 0) === 1,
        inSameCouncil: Number(first('IPOAH')?.IN_SAME_COUNCIL ?? 0) === 1,
        completionStatus: idText(first('IPOAH')?.COMPLETION_STATUS),
        interest: first('IPOAH') ? amounts.IPOAH : '',
      },
      IPRE: { cityType: idText(first('IPRE')?.CITY_TYPE), rent: first('IPRE') ? amounts.IPRE : '' },
    },
    notices,
    storageConfigured,
  };
}

/** CI's summary cards: CTC (job_mst EMP_GROSS_SALARY), and the tax figures (taxSummary.ts). */
async function summaryFor(h: Header): Promise<DeclarationPage['summary']> {
  const [job] = await prisma.$queryRaw<Array<{ ctc: string | null }>>`
    SELECT "EMP_GROSS_SALARY"::text AS ctc FROM job_mst WHERE "EMP_ID" = ${h.empId} AND "IS_DELETED" = 0 ORDER BY "JOB_ID" LIMIT 1`;
  const out: DeclarationPage['summary'] = {
    ctc: job?.ctc ?? null, professionalTax: null, standardDeduction: null, taxableIncome: null, taxPayable: null, regime: null, note: null,
  };
  try {
    const setup = await loadTaxYear(h.brand, h.fyId);
    const figures = setup ? await employeeTaxFigures(setup, h.empId, money(h.benefit)) : null;
    if (!figures) {
      out.note = 'No salary breakup for this financial year: the taxable income and tax cannot be worked out yet.';
      return out;
    }
    Object.assign(out, {
      professionalTax: figures.professionalTax, standardDeduction: figures.standardDeduction, taxableIncome: figures.taxableIncome,
      taxPayable: figures.taxPayable, regime: figures.regime,
      note: figures.regimeUnknown ? "The employee's job record does not say which tax regime applies; the old regime is assumed." : null,
    });
  } catch (e) {
    out.note = e instanceof Error ? e.message : 'The tax could not be worked out.';
  }
  return out;
}

// ------------------------------------------------------------------ saves

interface SaveContext {
  tx: Tx;
  h: Header;
  actor: number;
  scope: RuleScope;
  options: Options & { dependents: IdLabel[] };
  warnings: string[];
}

/** A file picked for a slot, checked before anything is written; stored once the rows are saved. */
interface PendingFile {
  slot: Slot | { medicalIndex: number };
  file: File;
  kind: 'single' | 'medical';
}

const noRule = (h: Header, what: string) =>
  `No Investment Declaration Rule matches ${what} for ${h.fyName ?? 'this financial year'}: its benefit is 0 (Benefit Rules).`;

/** CI updatedonations / upsertdonations. */
async function saveDonations(c: SaveContext, form: FormData, check: Checks) {
  const amount = amountOf(form.get('amount'), 'amount', 'Employee 80G Investment', check, true);
  const payment = choiceOf(form.get('payment'), c.options.payment, 'payment', 'Payment Mode', check, amount > 0);
  check.throwIfAny();
  const rule = await matchingRule(c.tx, c.scope, 'IPCCD', { payment });
  if (!rule && amount > 0) c.warnings.push(noRule(c.h, 'this payment mode'));
  await upsertSingle(c.tx, 'IPCCD', c.h, { INVESTMENT_AMT: String(amount), PAYMENT: payment, ACTUAL_AMOUNT: fixed(cappedBenefit(rule, amount), 0) }, { ATTACHMENT: null }, c.actor);
}

/** CI updatenps / upsertnps. */
async function saveNps(c: SaveContext, form: FormData, check: Checks) {
  const amount = amountOf(form.get('amount'), 'amount', 'Employee 80CCD(1B) Investment', check, true);
  check.throwIfAny();
  const rule = await matchingRule(c.tx, c.scope, 'IPCTN');
  if (!rule && amount > 0) c.warnings.push(noRule(c.h, 'Contribution to NPS'));
  await upsertSingle(c.tx, 'IPCTN', c.h, { INVESTMENT_AMT: String(amount), ACTUAL_AMOUNT: fixed(cappedBenefit(rule, amount), 0) }, {}, c.actor);
}

/** CI updatedependent / upsertdependent (80DD; the limit follows the dependent's severity). */
async function saveDependent(c: SaveContext, form: FormData, check: Checks) {
  const amount = amountOf(form.get('amount'), 'amount', 'Employee 80DD Investment', check, true);
  const type = choiceOf(form.get('type'), c.options.dependentType, 'type', 'Dependent Type', check, amount > 0);
  check.throwIfAny();
  const rule = await matchingRule(c.tx, c.scope, 'DDTYPE', { severe: type });
  if (!rule && amount > 0) c.warnings.push(noRule(c.h, 'this dependent type'));
  await upsertSingle(c.tx, 'DDTYPE', c.h, { INVESTMENT_TPE: type, INVESTMENT_AMT: String(amount), ACTUAL_AMOUNT: fixed(cappedBenefit(rule, amount), 0) }, {}, c.actor);
}

/** CI updatedisability / upsertdisability (80U: the rule's limit for the disability type is the benefit). */
async function saveDisability(c: SaveContext, form: FormData, check: Checks) {
  const type = choiceOf(form.get('type'), c.options.disabilityType, 'type', 'Disability Type', check, true);
  check.throwIfAny();
  const rule = await matchingRule(c.tx, c.scope, 'SEC80', { disability: type });
  if (!rule) c.warnings.push(noRule(c.h, 'this disability type'));
  await upsertSingle(c.tx, 'SEC80', c.h, { DIS_TYPE: type, ACTUAL_AMOUNT: fixed(limitBenefit(rule), 0) }, {}, c.actor);
}

/** CI updateEducationLoan / upsertEducationLoan (80E). */
async function saveEducation(c: SaveContext, form: FormData, check: Checks) {
  const interest = amountOf(form.get('interest'), 'interest', 'Interest paid for Educational Loan', check, false);
  const year = choiceOf(form.get('year'), c.options.years, 'year', 'In which year Interest was first paid', check, false);
  check.throwIfAny();
  const rule = await matchingRule(c.tx, c.scope, 'IPEE');
  if (!rule && interest > 0) c.warnings.push(noRule(c.h, 'Section 80E'));
  await upsertSingle(c.tx, 'IPEE', c.h, { INTEREST_PAID: fixed(interest, 2), YEAR: year, ACTUAL_AMOUNT: fixed(cappedBenefit(rule, interest), 2) }, {}, c.actor);
}

/** CI updateHomeLoan / upsertHomeLoan (24b: the limit follows self-occupied, completion status and same council). */
async function saveHomeLoan(c: SaveContext, form: FormData, check: Checks) {
  const interest = amountOf(form.get('interest'), 'interest', 'Interest paid for Home Loan', check, false);
  const completionStatus = choiceOf(form.get('completionStatus'), c.options.completionStatus, 'completionStatus', 'Completion Status', check, false);
  const selfOccupied = flag(form.get('selfOccupied')) ? 1 : 0;
  const inSameCouncil = flag(form.get('inSameCouncil')) ? 1 : 0;
  check.throwIfAny();
  const rule = await matchingRule(c.tx, c.scope, 'IPOAH', { selfOccupied, completionStatus, inSameCouncil });
  if (!rule && interest > 0) c.warnings.push(noRule(c.h, 'this home loan'));
  await upsertSingle(c.tx, 'IPOAH', c.h, {
    LOAN_AMOUNT: fixed(interest, 2), SELF_OCCUPIED: selfOccupied, COMPLETION_STATUS: completionStatus || null, IN_SAME_COUNCIL: inSameCouncil,
    ACTUAL_AMOUNT: fixed(cappedBenefit(rule, interest), 2),
  }, {}, c.actor);
}

/** CI getActualMonthlyAmountOfComponent: the component's monthly amount on the employee's current annexure. */
async function annexureMonthly(db: Tx, empId: number, code: string): Promise<number | null> {
  const [component, prstax] = await Promise.all([getMasterId(code), getMasterId('PRSTAX')]);
  if (!component || !prstax) return null;
  const [r] = await db.$queryRaw<Array<{ amount: string | null }>>`
    SELECT d."ACTUAL_AMOUNT"::text AS amount FROM emp_basic_sal_dtl d JOIN emp_basic_sal_mst h ON h."EMP_SAL_ID" = d."SAL_MST_ID"
    WHERE h."EMP_ID" = ${empId} AND h."SAL_TYPE" = ${prstax} AND h."IS_CURRENT" = 1 AND h."IS_DELETED" = 0
      AND d."IS_DELETED" = 0 AND d."SAL_COMP_ID" = ${component}
    ORDER BY h."EMP_SAL_ID" DESC, d."EMP_BASIC_SAL_DTL_ID" LIMIT 1`;
  return r ? money(r.amount) : null;
}

export interface HraFigures {
  /** Yearly HRA of the current annexure (CI rule one). */
  hra: number;
  /** 50 % (metro) / 40 % of the yearly basic (rule two). */
  cityBasis: number;
  /** Rent − 10 % of the yearly basic (rule three). */
  rentExemption: number;
  /** min of the three, never below 0. */
  exemption: number;
  annexureFound: boolean;
}

/** CI customHRAexemption (Section 10(13A)). */
export async function hraExemption(db: Tx, empId: number, cityType: string, rent: number): Promise<HraFigures> {
  const [hraMonthly, basicMonthly, metro] = await Promise.all([annexureMonthly(db, empId, 'SCHR'), annexureMonthly(db, empId, 'SCBS'), getMasterId('CITYMT')]);
  const hra = (hraMonthly ?? 0) * 12;
  const basic = (basicMonthly ?? 0) * 12;
  const cityBasis = (metro !== null && String(metro) === cityType ? 0.5 : 0.4) * basic;
  const rentExemption = rent - 0.1 * basic;
  const exemption = Math.max(0, Math.min(hra, cityBasis, rentExemption));
  return { hra, cityBasis, rentExemption, exemption: Math.round(exemption * 100) / 100, annexureFound: hraMonthly !== null || basicMonthly !== null };
}

/** CI updateHRA / upsertHRA. */
async function saveHra(c: SaveContext, form: FormData, check: Checks) {
  const rent = amountOf(form.get('rent'), 'rent', 'Rent paid per annum', check, false);
  const cityType = choiceOf(form.get('cityType'), c.options.cityType, 'cityType', 'City Type', check, false);
  check.throwIfAny();
  const figures = await hraExemption(c.tx, c.h.empId, cityType, rent);
  if (!figures.annexureFound && rent > 0) c.warnings.push('The employee has no current annexure: the HRA exemption is 0.');
  await upsertSingle(c.tx, 'IPRE', c.h, { RENT_AMOUNT: fixed(rent, 2), CITY_TYPE: cityType || 0, ACTUAL_AMOUNT: fixed(figures.exemption, 2) }, {}, c.actor);
}

/** CI updateTaxSavings / upsertTaxSavings (80C): `amounts` is a JSON object { sub-section master id: amount }. */
async function saveTaxSavings(c: SaveContext, form: FormData, check: Checks) {
  let posted: Record<string, unknown>;
  try {
    posted = JSON.parse(text(form.get('amounts')) || '{}') as Record<string, unknown>;
  } catch {
    throw new ValidationError('Validation failed.', { amounts: ['The amounts could not be read.'] });
  }
  const groups = await subSections();
  const items = groups.flatMap((g) => g.items);
  const values = new Map<number, number>();
  for (const [key, raw] of Object.entries(posted)) {
    const item = items.find((i) => String(i.id) === key);
    if (!item) {
      check.fail(`sub_${key}`, 'Unknown sub-section.');
      continue;
    }
    values.set(item.id, amountOf(raw, `sub_${key}`, item.name, check, false));
  }
  check.throwIfAny();
  const [ts] = await liveRows(c.tx, 'IPIITS', c.h.id);
  const tsId = ts
    ? Number(ts.ID)
    : await insertRow(c.tx, 'emp_tax_savings', 'ID', { INVESTMENT_ID: c.h.id, INVESTMENT_AMOUNT: '0', ACTUAL_AMOUNT: '0', ...ownership(c.h) }, c.actor);
  for (const [sub, amount] of values) {
    const existing = await c.tx.$queryRaw<Array<{ id: number }>>`
      SELECT "ID" AS id FROM emp_sub_section_details WHERE "TAX_SAVINGS_ID" = ${tsId} AND "SUB_SECTION_ID" = ${sub} AND COALESCE("IS_DELETED", 0) = 0 ORDER BY "ID"`;
    if (existing.length) {
      for (const e of existing) await updateRow(c.tx, 'emp_sub_section_details', 'ID', Number(e.id), { INVESTMENT_AMOUNT: fixed(amount, 2) }, c.actor);
    } else if (amount > 0) {
      await insertRow(c.tx, 'emp_sub_section_details', 'ID', { TAX_SAVINGS_ID: tsId, SUB_SECTION_ID: sub, INVESTMENT_AMOUNT: fixed(amount, 2), ...ownership(c.h) }, c.actor);
    }
  }
  // The total is what the sub-sections now hold (one row per sub-section, as the form shows them).
  const [sum] = await c.tx.$queryRaw<Array<{ total: string | null }>>`
    SELECT sum(x.amount)::text AS total FROM (
      SELECT DISTINCT ON (d."SUB_SECTION_ID") d."INVESTMENT_AMOUNT" AS amount FROM emp_sub_section_details d
      WHERE d."TAX_SAVINGS_ID" = ${tsId} AND COALESCE(d."IS_DELETED", 0) = 0 ORDER BY d."SUB_SECTION_ID", d."ID") x`;
  const total = money(sum?.total);
  if (total > MAX_AMOUNT) throw new ValidationError('Validation failed.', { amounts: ['The total cannot exceed 99,99,999.'] });
  const rule = await matchingRule(c.tx, c.scope, 'IPIITS');
  if (!rule && total > 0) c.warnings.push(noRule(c.h, 'Section 80C'));
  for (const r of await liveRows(c.tx, 'IPIITS', c.h.id)) {
    await updateRow(c.tx, 'emp_tax_savings', 'ID', Number(r.ID), { INVESTMENT_AMOUNT: fixed(total, 2), ACTUAL_AMOUNT: fixed(cappedBenefit(rule, total), 2) }, c.actor);
  }
}

interface MedicalInput {
  id: number | null;
  dependent: string;
  type: string;
  age: string;
  amount: number;
}

/** CI updatemedicial / upsertmedicial: the posted rows replace the declaration's rows (`rows`: JSON array). */
async function saveMedical(c: SaveContext, form: FormData, check: Checks, files: PendingFile[]): Promise<{ removed: number[]; ids: number[] }> {
  let posted: unknown;
  try {
    posted = JSON.parse(text(form.get('rows')) || '[]');
  } catch {
    posted = null;
  }
  if (!Array.isArray(posted)) throw new ValidationError('Validation failed.', { rows: ['The rows could not be read.'] });
  if (posted.length > MAX_MEDICAL_ROWS) throw new ValidationError('Validation failed.', { rows: [`At most ${MAX_MEDICAL_ROWS} dependents.`] });
  const nameColumn = await hasColumn('medical_expenses_details', 'INVESTMENT_NAME');
  const existing = await liveRows(c.tx, 'IPME', c.h.id);
  const existingIds = new Set(existing.map((r) => Number(r.EL_ID)));
  const inputs: MedicalInput[] = posted.map((raw, i) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const id = Number(r.id) || null;
    if (id && !existingIds.has(id)) check.fail(`rows.${i}`, 'This dependent row no longer exists; reload the page.');
    return {
      id,
      dependent: nameColumn ? choiceOf(r.dependent, c.options.dependents, `rows.${i}.dependent`, 'Dependent Name', check, true) : '',
      type: choiceOf(r.type, c.options.medicalType, `rows.${i}.type`, 'Dependent Type', check, true),
      age: choiceOf(r.age, c.options.age, `rows.${i}.age`, 'Age', check, true),
      amount: amountOf(r.amount, `rows.${i}.amount`, 'Employee 80D Investment', check, true),
    };
  });
  check.throwIfAny();
  const ids: number[] = [];
  for (const row of inputs) {
    const rule = await matchingRule(c.tx, c.scope, 'IPME', { expenses: row.type, age: row.age });
    if (!rule && row.amount > 0) c.warnings.push(noRule(c.h, 'a medical expense of this dependent type and age'));
    const data: Record<string, DbValue> = {
      INVESTMENT_TYPE: row.type, AGE: row.age, INVESTMENT_AMT: String(row.amount), ACTUAL_AMOUNT: fixed(cappedBenefit(rule, row.amount), 0),
      ...(nameColumn ? { INVESTMENT_NAME: row.dependent } : {}),
    };
    if (row.id) {
      await updateRow(c.tx, 'medical_expenses_details', 'EL_ID', row.id, data, c.actor);
      ids.push(row.id);
    } else {
      ids.push(await insertRow(c.tx, 'medical_expenses_details', 'EL_ID', { ...data, INVESTMENT_ID: c.h.id, ...ownership(c.h) }, c.actor));
    }
  }
  const kept = new Set(inputs.map((r) => r.id).filter(Boolean));
  const removed = [...existingIds].filter((id) => !kept.has(id));
  await softDelete(c.tx, 'medical_expenses_details', 'EL_ID', removed, c.actor);
  // Files of new rows are named after the row id, known only now.
  for (const f of files) if (typeof f.slot === 'object') f.slot = `med${ids[f.slot.medicalIndex]}`;
  return { removed, ids };
}

const SAVERS: Record<Exclude<SectionCode, 'IPME'>, (c: SaveContext, form: FormData, check: Checks) => Promise<void>> = {
  IPCCD: saveDonations, IPCTN: saveNps, DDTYPE: saveDependent, SEC80: saveDisability, IPEE: saveEducation,
  IPIITS: saveTaxSavings, IPOAH: saveHomeLoan, IPRE: saveHra,
};

/** Stores the checked files once the rows are saved; a section table with an ATTACHMENT column gets the name too. */
async function storeFiles(code: SectionCode, h: Header, files: PendingFile[], actor: number, warnings: string[]) {
  const column = await hasColumn(TABLES[code].table, 'ATTACHMENT');
  for (const f of files) {
    if (typeof f.slot === 'object') continue;
    try {
      const name = await storeSlotFile(h.id, f.slot, f.file, f.kind);
      if (!column) continue;
      if (code === 'IPME') {
        await updateRow(prisma, TABLES.IPME.table, 'EL_ID', Number(f.slot.slice(3)), { ATTACHMENT: name }, actor);
      } else {
        for (const r of await liveRows(prisma, code, h.id)) await updateRow(prisma, TABLES[code].table, TABLES[code].pk, Number(r[TABLES[code].pk]), { ATTACHMENT: name }, actor);
      }
    } catch (e) {
      warnings.push(`Saved, but the attachment was not stored: ${e instanceof Error ? e.message : 'upload failed.'}`);
    }
  }
}

/** CI update<Section>: saves one section (multipart: its fields and the picture(s)), then rolls the header up. */
export async function saveSection(subject: RequestSubject, rawId: string, rawCode: string, form: FormData): Promise<SaveResult> {
  if (!isSectionCode(rawCode)) throw new NotFoundError();
  const code = rawCode;
  const h = await loadHeader(subject, rawId, 'edit');
  const check = new Checks();
  // The pictures are checked before anything is written (CI saved the name of a refused file).
  const files: PendingFile[] = [];
  const slot = SLOTS[code];
  if (slot) {
    const file = await checkUpload(form.get('file'), 'single', 'file');
    if (file) files.push({ slot, file, kind: 'single' });
  }
  if (code === 'IPME') {
    for (const [key, value] of form.entries()) {
      const m = /^file_(\d+)$/.exec(key);
      if (!m) continue;
      const file = await checkUpload(value, 'medical', `rows.${m[1]}.file`);
      if (file) files.push({ slot: { medicalIndex: Number(m[1]) }, file, kind: 'medical' });
    }
  }
  // The stored year stays valid when it has left the list (keepCurrent), never a posted one.
  const storedYear = code === 'IPEE' ? (await liveRows(prisma, 'IPEE', h.id))[0]?.YEAR : null;
  const options = { ...(await optionsFor(h, storedYear)), dependents: code === 'IPME' ? await dependentsOf(h.empId) : [] };
  const scope: RuleScope = { brand: h.brand, country: await brandCountry(h.brand), fy: h.fyId };
  const warnings: string[] = [];
  let removedMedical: number[] = [];
  const totals = await prisma.$transaction(async (tx) => {
    const c: SaveContext = { tx, h, actor: subject.userId, scope, options, warnings };
    if (code === 'IPME') removedMedical = (await saveMedical(c, form, check, files)).removed;
    else await SAVERS[code](c, form, check);
    return rollUp(tx, h.id, subject.userId);
  }, { timeout: 30000 });
  for (const id of removedMedical) await detachSlotFiles(h.id, `med${id}`);
  await storeFiles(code, h, files, subject.userId, warnings);
  return { message: MESSAGES[code], totals, warnings };
}

/** CI delete<Section> (the dialogs' Reset): the section's rows are removed and the header rolled up again. */
export async function resetSection(subject: RequestSubject, rawId: string, rawCode: string): Promise<SaveResult> {
  if (!isSectionCode(rawCode)) throw new NotFoundError();
  const code = rawCode;
  const h = await loadHeader(subject, rawId, 'edit');
  const { table, pk } = TABLES[code];
  let medical: number[] = [];
  const totals = await prisma.$transaction(async (tx) => {
    const rows = await liveRows(tx, code, h.id);
    const ids = rows.map((r) => Number(r[pk]));
    if (code === 'IPIITS' && ids.length) {
      // CI delete_taxes: the 80C row and its sub-sections.
      const details = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT "ID" AS id FROM emp_sub_section_details WHERE "TAX_SAVINGS_ID" = ANY(${ids}::int[]) AND COALESCE("IS_DELETED", 0) = 0`;
      await softDelete(tx, 'emp_sub_section_details', 'ID', details.map((d) => Number(d.id)), subject.userId);
    }
    if (code === 'IPME') medical = ids;
    await softDelete(tx, table, pk, ids, subject.userId);
    return rollUp(tx, h.id, subject.userId);
  }, { timeout: 30000 });
  const slot = SLOTS[code];
  if (slot) await detachSlotFiles(h.id, slot);
  for (const id of medical) await detachSlotFiles(h.id, `med${id}`);
  return { message: 'Reset Successful', totals, warnings: [] };
}

/** CI medicial_delete: one Medical Expenses row is removed and the header rolled up again. */
export async function removeMedicalRow(subject: RequestSubject, rawId: string, rawRow: string): Promise<SaveResult> {
  const h = await loadHeader(subject, rawId, 'edit');
  const rowId = parseId(rawRow);
  const totals = await prisma.$transaction(async (tx) => {
    const rows = await liveRows(tx, 'IPME', h.id);
    if (!rows.some((r) => Number(r.EL_ID) === rowId)) throw new NotFoundError('Record not found.');
    await softDelete(tx, 'medical_expenses_details', 'EL_ID', [rowId], subject.userId);
    return rollUp(tx, h.id, subject.userId);
  }, { timeout: 30000 });
  await detachSlotFiles(h.id, `med${rowId}`);
  return { message: 'Dependent removed.', totals, warnings: [] };
}

/** A section's picture (CI: a public link to uploads/file_attachment). `slot`: don / nps / dd / dis / med{row}. */
export async function declarationAttachment(subject: RequestSubject, rawId: string, rawSlot: string): Promise<{ name: string; data: Buffer; contentType: string | null }> {
  const h = await loadHeader(subject, rawId, 'view');
  const all = await Promise.all(SECTION_CODES.map((c) => liveRows(prisma, c, h.id)));
  const rows = Object.fromEntries(SECTION_CODES.map((c, i) => [c, all[i]])) as Record<SectionCode, Array<Record<string, unknown>>>;
  const name = (await attachmentsOf(h.id, rows))[rawSlot];
  if (!name) throw new NotFoundError('Document Not Found!!');
  const { data, contentType } = await readDeclarationFile(name);
  return { name, data, contentType };
}
