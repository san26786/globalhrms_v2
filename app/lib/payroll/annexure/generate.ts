import { z } from 'zod';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { columnsOf, fullName, isDate, type Tx } from '@/lib/employeeMngt/hub/hubEngine';
import { BusinessRuleError, ForbiddenError, ValidationError } from '@/lib/http/errors';
import { getMasterIds } from '@/lib/masters/masterService';
import { prisma } from '@/lib/prisma';
import { menuPolicy } from '@/lib/resource/policies';
import { settingService } from '@/lib/settings/settingService';
import { brandOrgId } from '@/lib/systmMngt/shared';
import { AnnexureError, computeAnnexure, type AnnexureInputs, type AnnexureRule, type AnnexureSetting, type Frequency } from './compute';
import { centsText, toCents } from './ruleMath';

/**
 * CI emp_sal_component_mst::generateAnnexureDetails (Annexure Processing → "Generate Salary Annexure"): new
 * annexures for one employee or every employee of the brand with a job salary — a yearly header and one of the
 * brand's pay frequency (emp_basic_sal_mst, SAL_TYPE PRSTAX), one row per component on each
 * (emp_basic_sal_dtl), the employee's salary breakup for the financial year (salary_breakup and its temp copy),
 * a snapshot for payroll (salary_breakup_for_calc) and the job's Mediclaim deduction. Amounts: ./compute.ts.
 *
 * As CI: the gross is the current job's; the financial year is the brand's that holds the month (lowest id when
 * several overlap — CI's rules live on it); "Current Annexure" makes the new annexure the one payroll uses.
 * Behaviour changes: admins with the menu's add grant only (CI's URL was open to anyone); the employees are the
 * brand's (CI took the brand of each employee's login user); every employee is checked before anything is written
 * and written in one transaction, and a problem skips that employee with CI's message instead of stopping the run
 * half-way; the month must be MM/YYYY and not in the future, the effective date a real date; deleted benefit rules
 * and salary component settings are ignored (CI deleted them for good); a brand without a financial year for the
 * month, without the Basic percentage or without benefit rules for the year is refused (CI wrote zeros); only the
 * employee's other annexures stop being current (CI cleared their payslips' flag too); the components carry the
 * employee's grade, position and currency (CI wrote 0) and the audit columns are set; Mediclaim goes on the new
 * annexure (CI put it on the previous current one, after the PDF), and only when the job has one (CI also wrote
 * 0.00 rows); no PDF file is written — the document is built on demand (./document.ts).
 */
const MENU = 'employeeMngt/emp_sal_component_mst/indexAnnexures';
const FREQUENCIES: Record<string, Frequency> = { annually: 'PFYLY', daily: 'PFDLY', weekly: 'PFWLY' };

const schema = z.object({
  empIds: z.union([z.literal('all'), z.array(z.coerce.number().int().positive()).min(1).max(500)]),
  monthYear: z.string().trim(),
  effectiveDate: z.string().trim(),
  isCurrent: z.boolean().default(false),
  calculateGratuity: z.boolean().default(false),
});

export interface GenerateResult {
  empId: number;
  name: string;
  status: 'generated' | 'skipped';
  message: string;
  ids?: { yearly: number; period: number };
}

const num = (v: string | null | undefined) => {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) ? n : 0;
};

/** Everything a brand's annexures need, loaded once per run. */
async function brandInputs(brand: number, fy: number) {
  const codes = await getMasterIds(['PRSTAX', 'PFYLY', 'PFMLY', 'PFWLY', 'PFDLY', 'SCBS', 'SCCC', 'SCGR', 'PCCTC', 'SFPLUS', 'SFMINUS', 'CFP', 'CFFAC',
    'CMPTA', 'CMPTC', 'CMPTD', 'SCMEDIDED']);
  const missing = Object.entries(codes).filter(([, id]) => !id).map(([c]) => c);
  if (missing.length) throw new BusinessRuleError(`Payroll masters are missing: ${missing.join(', ')}.`);
  const id = (c: string) => codes[c]!;
  const [frequency, monthly, weekly, basic] = await Promise.all(['SSAF', 'OASAMPG', 'OASAWPG', 'SSAMTPLBP'].map((c) => settingService.getValue(c, brand)));
  const settings = await prisma.$queryRaw<Array<{ component: number; calcType: number | null }>>`
    SELECT s."COMPONENT_ID" AS component, s."PAYROLL_COMP_CALC_TYPE" AS "calcType" FROM salary_component_settings s
    WHERE s."OA_BRAND_ID" = ${brand} AND s."IS_DELETED" = 0 AND s."VISIBLE_IN_ANNEXURE" = 1
      AND s."COMPONENT_TYPE" = ANY(${[id('CMPTA'), id('CMPTC'), id('CMPTD')]}::int[]) AND s."COMPONENT_ID" IS NOT NULL
    ORDER BY s."COMPONENT_SEQUENCE" ASC NULLS LAST, s."SC_ID" ASC`;
  const counts = await prisma.$queryRaw<Array<{ component: number; n: number }>>`
    SELECT s."COMPONENT_ID" AS component, count(*)::int AS n FROM salary_component_settings s
    WHERE s."OA_BRAND_ID" = ${brand} AND s."IS_DELETED" = 0 AND s."PAYROLL_COMP_CALC_TYPE" IS NOT NULL AND s."PAYROLL_COMP_CALC_TYPE" <> ${id('PCCTC')}
    GROUP BY s."COMPONENT_ID"`;
  const rules = await prisma.$queryRaw<Array<AnnexureRule & { lower: string }>>`
    SELECT r."BENEFIT_RULES_ID" AS id, r."COMPONENT_ID" AS component, r."CALCULATION_FACTOR" AS factor, r."DEPENDENT_ON_COMP" AS dependent,
      r."VALUES" AS values, r."SIGN_FACTOR" AS sign, r."LOWER_LIMIT"::text AS lower, r."UPPER_LIMIT" AS upper, r."OPEN_LIMIT" AS open
    FROM pay_component_benefit_rules r
    WHERE r."OA_BRAND_ID" = ${brand} AND r."FINANCIAL_YEAR_ID" = ${fy} AND COALESCE(r."IS_DELETED", 0) = 0
      AND r."SIGN_FACTOR" IN (${id('SFPLUS')}, ${id('SFMINUS')})`;
  return {
    codes: id,
    frequency: FREQUENCIES[String(frequency ?? '').trim().toLowerCase()] ?? ('PFMLY' as Frequency),
    monthlyPercent: num(monthly),
    weeklyPercent: num(weekly),
    basicPercent: num(basic),
    settings: settings.map((s): AnnexureSetting => ({ component: Number(s.component), calcType: s.calcType === null ? null : Number(s.calcType) })),
    nonConstantRows: new Map(counts.map((c) => [Number(c.component), Number(c.n)])),
    rules: rules.map((r) => ({ ...r, id: Number(r.id), component: Number(r.component), factor: Number(r.factor), sign: Number(r.sign), open: Number(r.open), lower: Number(r.lower), dependent: String(r.dependent ?? ''), values: String(r.values ?? ''), upper: String(r.upper ?? '') })),
  };
}

type Brand = Awaited<ReturnType<typeof brandInputs>>;

interface Employee {
  id: number;
  name: string;
  user: number | null;
  oa: number | null;
  job: { gross: number | null; dept: number | null; grade: number | null; position: number | null; currency: number | null; mediclaim: string | null; basicDaily: string | null; joined: string | null } | null;
}

async function employee(id: number): Promise<Employee> {
  const [e] = await prisma.$queryRawUnsafe<Array<{ name: string; user: number | null; oa: number | null }>>(
    `SELECT ${fullName('em')} AS name, em."REF_EMP_ID" AS "user", em."OA_ID" AS oa FROM emp_mst em WHERE em."EMP_ID" = $1::int`,
    id,
  );
  // CI: the newest live job row with a gross.
  const [job] = await prisma.$queryRaw<Array<NonNullable<Employee['job']>>>`
    SELECT j."EMP_GROSS_SALARY" AS gross, j."DEPARTMENT_ID" AS dept, j."EMP_GRADE_ID" AS grade, j."DESIGNATION_ID" AS position, j."CURRENCY_ID" AS currency,
      j."MEDICLAIM"::text AS mediclaim, j."BASIC_DAILY"::text AS "basicDaily", to_char(j."DATE_OF_JOINING", 'YYYY-MM-DD') AS joined
    FROM job_mst j WHERE j."EMP_ID" = ${id} AND j."IS_DELETED" = 0 AND j."EMP_GROSS_SALARY" IS NOT NULL ORDER BY j."JOB_ID" DESC LIMIT 1`;
  return { id, name: e?.name ?? `Employee #${id}`, user: e?.user ? Number(e.user) : null, oa: e?.oa ? Number(e.oa) : null, job: job ?? null };
}

/** salary_breakup (or its temp copy) of the employee and financial year: updated, else added. */
async function setBreakup(tx: Tx, table: 'salary_breakup' | 'salary_breakup_temp', v: { emp: number; fy: number; monthly: string; gross: string; oa: number; brand: number; user: number; by: number }) {
  await assertInsertSafe(table, 'SLB_ID');
  await tx.$executeRawUnsafe(
    `WITH upd AS (
       UPDATE ${table} s SET "MONTHLY_SALARY" = $3::numeric, "CTC" = $4::numeric, "ANNUAL_SALARY" = $4::numeric, "UPDATED_BY" = $8::int, "UPDATED_ON" = now()
       WHERE s."SLB_ID" = (SELECT "SLB_ID" FROM ${table} WHERE "EMP_ID" = $1::int AND "YEAR" = $2::int ORDER BY "SLB_ID" LIMIT 1)
       RETURNING 1)
     INSERT INTO ${table} ("EMP_ID", "YEAR", "MONTHLY_SALARY", "CTC", "ANNUAL_SALARY", "OA_ID", "OA_BRAND_ID", "USER_ID", "IS_DELETED", "CREATED_BY", "CREATED_ON", "UPDATED_BY", "UPDATED_ON")
     SELECT $1::int, $2::int, $3::numeric, $4::numeric, $4::numeric, $5::int, $6::int, $7::int, 0, $8::int, now(), $8::int, now()
     WHERE NOT EXISTS (SELECT 1 FROM upd)`,
    v.emp, v.fy, v.monthly, v.gross, v.oa, v.brand, v.user, v.by,
  );
}

/** CI replicateFromSalaryBreakUp: a snapshot of the breakup for the annexure's month (payroll reads the newest). */
async function snapshotBreakup(tx: Tx, emp: number, fy: number, month: number, year: number) {
  await assertInsertSafe('salary_breakup_for_calc', 'SLB_ID');
  const [from, to] = await Promise.all([columnsOf('salary_breakup'), columnsOf('salary_breakup_for_calc')]);
  const shared = [...to.values()].map((c) => c.name).filter((c) => !['SLB_ID', 'MONTH', 'YEAR'].includes(c.toUpperCase()) && from.has(c.toUpperCase()));
  const list = shared.map((c) => `"${c}"`).join(', ');
  await tx.$executeRawUnsafe(
    `INSERT INTO salary_breakup_for_calc ("MONTH", "YEAR", ${list}) SELECT $3::int, $4::int, ${list} FROM salary_breakup WHERE "EMP_ID" = $1::int AND "YEAR" = $2::int`,
    emp, fy, month, year,
  );
}

/** One employee's annexure, written in one transaction. */
async function writeAnnexure(subject: RequestSubject, e: Employee, b: Brand, run: { brand: number; fy: number; month: number; year: number; effective: string; isCurrent: boolean; calculateGratuity: boolean; today: string }): Promise<GenerateResult> {
  const skip = (message: string): GenerateResult => ({ empId: e.id, name: e.name, status: 'skipped', message });
  if (!e.job || !e.job.gross) return skip('Please Update Salary In Job Details');
  const inputs: AnnexureInputs = {
    gross: Number(e.job.gross), frequency: b.frequency, monthlyPercent: b.monthlyPercent, weeklyPercent: b.weeklyPercent, basicPercent: b.basicPercent,
    settings: b.settings, rules: b.rules, nonConstantRows: b.nonConstantRows,
    codes: { SCBS: b.codes('SCBS'), SCCC: b.codes('SCCC'), SCGR: b.codes('SCGR'), PCCTC: b.codes('PCCTC'), SFPLUS: b.codes('SFPLUS'), SFMINUS: b.codes('SFMINUS'), CFP: b.codes('CFP'), CFFAC: b.codes('CFFAC') },
    gratuity: { calculate: run.calculateGratuity, basicDaily: e.job.basicDaily === null ? null : Number(e.job.basicDaily), joined: e.job.joined, today: run.today },
    currentYear: Number(run.today.slice(0, 4)),
  };
  let result;
  try {
    result = computeAnnexure(inputs);
  } catch (err) {
    if (err instanceof AnnexureError) return skip(err.message);
    throw err;
  }

  const prstax = b.codes('PRSTAX');
  const yearlyFrequency = b.codes('PFYLY');
  const periodFrequency = b.codes(b.frequency);
  const oa = e.oa ?? (await brandOrgId(run.brand, null)) ?? 0;
  const month = String(run.month).padStart(2, '0');
  const year = String(run.year);
  const job = e.job;
  const ids = await prisma.$transaction(async (tx) => {
    await assertInsertSafe('emp_basic_sal_mst', 'EMP_SAL_ID');
    await assertInsertSafe('emp_basic_sal_dtl', 'EMP_BASIC_SAL_DTL_ID');
    // The two headers must get adjacent ids (nothing else links them).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('emp_basic_sal_mst'))`;
    const headers = await tx.$queryRaw<Array<{ id: number }>>`
      INSERT INTO emp_basic_sal_mst ("EMP_ID", "DEPT_ID", "EMP_GRADE_ID", "POSITION_ID", "CURRENCY_ID", "ACTUAL_AMOUNT", "EARNED_AMOUNT", "SAL_TYPE",
        "PAY_FREQUENCY_ID", "TRANSACTION_STATUS", "MONTH", "YEAR", "EFFECTIVE_DATE", "IS_CURRENT", "COMMENTS", "IS_GENERATED", "IS_DELETED",
        "CREATED_BY", "CREATED_ON", "UPDATED_BY", "UPDATED_ON", "OA_ID", "OA_BRAND_ID", "USER_ID")
      VALUES
        (${e.id}, ${job.dept}, ${job.grade}, ${job.position}, ${job.currency}, ${centsText(result.yearlyTotal)}::numeric, ${centsText(result.yearlyTotal)}::numeric, ${prstax},
         ${yearlyFrequency}, 0, ${month}, ${year}, ${run.effective}::date, 0, '', 1, 0, ${subject.userId}, now(), ${subject.userId}, now(), ${oa}, ${run.brand}, ${e.user}),
        (${e.id}, ${job.dept}, ${job.grade}, ${job.position}, ${job.currency}, ${centsText(result.periodTotal)}::numeric, ${centsText(result.periodTotal)}::numeric, ${prstax},
         ${periodFrequency}, 0, ${month}, ${year}, ${run.effective}::date, ${run.isCurrent ? 1 : 0}, '', 1, 0, ${subject.userId}, now(), ${subject.userId}, now(), ${oa}, ${run.brand}, ${e.user})
      RETURNING "EMP_SAL_ID" AS id`;
    const [yearlyId, periodId] = headers.map((h) => Number(h.id)).sort((a, b2) => a - b2);
    if (periodId !== yearlyId + 1) throw new Error('The annexure headers did not get adjacent ids.');

    const rows = [
      ...result.lines.map((l) => ({ header: yearlyId, frequency: yearlyFrequency, component: l.component, amount: l.yearly, comments: '' })),
      ...result.lines.map((l) => ({ header: periodId, frequency: periodFrequency, component: l.component, amount: l.period, comments: '' })),
    ];
    const mediclaim = job.mediclaim === null ? 0 : toCents(job.mediclaim);
    if (mediclaim) rows.push({ header: periodId, frequency: periodFrequency, component: b.codes('SCMEDIDED'), amount: mediclaim, comments: 'Mediclaim Deduction' });
    for (const r of rows) {
      await tx.$executeRaw`
        INSERT INTO emp_basic_sal_dtl ("SAL_MST_ID", "EMP_ID", "EMP_GRADE_ID", "POSITION_ID", "CURRENCY_ID", "SAL_COMP_ID", "ACTUAL_AMOUNT", "EARNED_AMOUNT",
          "PAY_FREQUENCY_ID", "MONTH", "YEAR", "COMPONENT_DESC", "COMMENTS", "IS_DELETED", "CREATED_BY", "CREATED_ON", "UPDATED_BY", "UPDATED_ON", "OA_ID", "OA_BRAND_ID", "USER_ID")
        VALUES (${r.header}, ${e.id}, ${job.grade ?? 0}, ${job.position ?? 0}, ${job.currency ?? 0}, ${r.component}, ${centsText(r.amount)}::numeric, ${centsText(r.amount)}::numeric,
          ${r.frequency}, ${month}, ${year}, '', ${r.comments}, 0, ${subject.userId}, now(), ${subject.userId}, now(), ${oa}, ${run.brand}, ${e.user})`;
    }

    if (run.isCurrent) {
      await tx.$executeRaw`
        UPDATE emp_basic_sal_mst SET "IS_CURRENT" = 0, "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now()
        WHERE "EMP_ID" = ${e.id} AND "SAL_TYPE" = ${prstax} AND "IS_CURRENT" = 1 AND "EMP_SAL_ID" <> ${periodId}`;
    }
    const breakup = { emp: e.id, fy: run.fy, monthly: centsText(result.periodSalary), gross: centsText(result.gross), oa, brand: run.brand, user: e.user ?? subject.userId, by: subject.userId };
    await setBreakup(tx, 'salary_breakup', breakup);
    await setBreakup(tx, 'salary_breakup_temp', breakup);
    await snapshotBreakup(tx, e.id, run.fy, run.month, run.year);
    return { yearly: yearlyId, period: periodId };
  }, { timeout: 60000 });
  return { empId: e.id, name: e.name, status: 'generated', message: 'Annexure Generated Successfully', ids };
}

const MONTH_RE = /^(0?[1-9]|1[0-2])\/(\d{4})$/;

export const annexureGenerator = {
  /** The Generate dialog: the brand's employees, defaults, whether gratuity can be asked for, what the caller may do. */
  async options(subject: RequestSubject) {
    const brand = subject.oaBrandId ?? null;
    const [generate, markCurrent] = await Promise.all([
      subject.adminLevel > 0 && brand ? menuPolicy(MENU).check(subject, 'create') : Promise.resolve(false),
      subject.adminLevel > 0 && brand ? menuPolicy(MENU).check(subject, 'update') : Promise.resolve(false),
    ]);
    const employees = brand
      ? await prisma.$queryRawUnsafe<Array<{ value: number; label: string; code: string | null }>>(
        `SELECT em."EMP_ID" AS value, ${fullName('em')} AS label, em."EMP_NBR" AS code FROM emp_mst em WHERE em."IS_DELETED" = 0 AND em."OA_BRAND_ID" = $1::int ORDER BY label, em."EMP_ID"`,
        brand,
      )
      : [];
    const [gratuity] = brand
      ? await prisma.$queryRaw<Array<{ n: number }>>`
          SELECT count(*)::int AS n FROM salary_component_settings s
          WHERE s."OA_BRAND_ID" = ${brand} AND s."IS_DELETED" = 0 AND s."IS_ENABLED" = 1
            AND s."COMPONENT_ID" = (SELECT "MSTR_ID" FROM independent_mst WHERE "MSTR_CD" = 'SCGR' ORDER BY "MSTR_ID" LIMIT 1)`
      : [{ n: 0 }];
    const now = new Date();
    return {
      employees: employees.map((r) => ({ value: Number(r.value), label: r.code ? `${r.label} (${r.code})` : r.label })),
      showGratuity: gratuity.n > 0,
      defaults: { monthYear: `${String(now.getUTCMonth() + 1).padStart(2, '0')}/${now.getUTCFullYear()}` },
      permissions: { generate, markCurrent },
      message: brand ? null : 'Select a brand first.',
    };
  },

  async generate(subject: RequestSubject, body: unknown): Promise<{ results: GenerateResult[]; message: string }> {
    const brand = subject.oaBrandId ?? null;
    if (subject.adminLevel === 0 || !(await menuPolicy(MENU).check(subject, 'create'))) throw new ForbiddenError();
    if (!brand) throw new BusinessRuleError('Select a brand first.');
    const parsed = schema.safeParse(body ?? {});
    if (!parsed.success) throw new ValidationError('Validation failed.', { empIds: ['The Employee field is required.'] });
    const v = parsed.data;
    const errors: Record<string, string[]> = {};
    const m = MONTH_RE.exec(v.monthYear);
    const now = new Date();
    if (!v.monthYear) errors.monthYear = ['The Month / Year field is required.'];
    else if (!m) errors.monthYear = ['The Month / Year field must be in MM/YYYY format.'];
    else if (Number(m[2]) * 12 + Number(m[1]) > now.getUTCFullYear() * 12 + now.getUTCMonth() + 1) errors.monthYear = ['The Month / Year cannot be in the future.'];
    if (!v.effectiveDate) errors.effectiveDate = ['The Effective Date field is required.'];
    else if (!isDate(v.effectiveDate)) errors.effectiveDate = ['The Effective Date field must be a valid date.'];
    if (Object.keys(errors).length) throw new ValidationError('Validation failed.', errors);
    const month = Number(m![1]);
    const year = Number(m![2]);

    const [fy] = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT p."PERIOD_ID" AS id FROM period_mst p
      WHERE p."OA_BRAND_ID" = ${brand} AND p."IS_DELETED" = 0
        AND p."PERIOD_TYPE_ID" = (SELECT "MSTR_ID" FROM independent_mst WHERE "MSTR_CD" = 'OPTFY' ORDER BY "MSTR_ID" LIMIT 1)
        AND make_date(${year}::int, ${month}::int, 1) BETWEEN p."PERIOD_START_DATE" AND p."PERIOD_END_DATE"
      ORDER BY p."PERIOD_ID" LIMIT 1`;
    if (!fy) throw new ValidationError('Validation failed.', { monthYear: [`No financial year covers ${String(month).padStart(2, '0')}/${year} for this brand.`] });
    const b = await brandInputs(brand, Number(fy.id));
    if (!b.basicPercent) throw new BusinessRuleError('Basic salary percentage (SSAMTPLBP) is not set for this brand.');
    // CI then saved Basic-only annexures (every component 0.00).
    if (b.settings.length && !b.rules.length) {
      throw new BusinessRuleError(`No benefit rules are set up for the financial year of ${String(month).padStart(2, '0')}/${year}.`);
    }

    let ids: number[];
    if (v.empIds === 'all') {
      const rows = await prisma.$queryRaw<Array<{ id: number }>>`
        SELECT DISTINCT j."EMP_ID" AS id FROM job_mst j JOIN emp_mst e ON e."EMP_ID" = j."EMP_ID" AND e."IS_DELETED" = 0 AND e."OA_BRAND_ID" = ${brand}
        WHERE j."IS_DELETED" = 0 AND COALESCE(j."EMP_GROSS_SALARY", 0) <> 0 ORDER BY 1`;
      ids = rows.map((r) => Number(r.id));
      if (!ids.length) throw new BusinessRuleError('Please Update Salary In Employees Job Details');
    } else {
      ids = [...new Set(v.empIds)];
      const [valid] = await prisma.$queryRaw<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM emp_mst WHERE "EMP_ID" = ANY(${ids}::int[]) AND "IS_DELETED" = 0 AND "OA_BRAND_ID" = ${brand}`;
      if (valid.n !== ids.length) throw new ValidationError('Validation failed.', { empIds: ['Select a valid Employee.'] });
    }

    const [{ d: today }] = await prisma.$queryRaw<Array<{ d: string }>>`SELECT to_char(current_date, 'YYYY-MM-DD') AS d`;
    const run = { brand, fy: Number(fy.id), month, year, effective: v.effectiveDate, isCurrent: v.isCurrent, calculateGratuity: v.calculateGratuity, today };
    const results: GenerateResult[] = [];
    for (const id of ids) results.push(await writeAnnexure(subject, await employee(id), b, run));
    const generated = results.filter((r) => r.status === 'generated').length;
    const message = results.length === 1 ? results[0].message : `Annexures generated: ${generated}. Skipped: ${results.length - generated}.`;
    return { results, message };
  },
};

// The rule loading is shared with the payroll run (P3).
export { brandInputs };
