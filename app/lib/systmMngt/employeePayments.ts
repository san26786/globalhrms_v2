import { endOfMonth, format, getDaysInMonth, getISOWeeksInYear, startOfMonth } from 'date-fns';
import { z } from 'zod';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { ForbiddenError, NotFoundError } from '@/lib/http/errors';
import { getMasterId } from '@/lib/masters/masterService';
import { prisma } from '@/lib/prisma';
import { menuPolicy } from '@/lib/resource/policies';
import { settingService } from '@/lib/settings/settingService';
import { activeBrand, brandOrgId } from './shared';

/**
 * CI systmMngt/employee_payment_details ("Payroll Processing": list, Generate Salary Details, Additional
 * Comments, delete) and the lists emp_monthly_payment_details / emp_yearly_payment_details ("Emp Monthly
 * Salary" / "Emp Yearly Salary": per-employee totals, read-only — see prisma/sql/views).
 *
 * Generate (CI generateBulkSalary → generateSalaryDetails → getSalaryByComp), per employee of the brand:
 *   frequency = brand setting SSAF (Annually / Daily / Weekly / else Monthly) → PFYLY / PFDLY / PFWLY / PFMLY;
 *   period share of the yearly gross (job_mst.EMP_GROSS_SALARY): annually × 1, monthly ÷ 12,
 *     weekly ÷ ISO weeks of the year, daily ÷ (12 × days of the month);
 *   for each enabled "Cost to Company" (SCCC) member component of the brand (salarycomponentmember, in
 *     calculation order): a benefit rule (pay_component_benefit_rules, highest LOWER_LIMIT ≤ gross) gives
 *     a percentage of the share (CFP) or a fixed amount (CFFAC); otherwise the component's
 *     COMPONENT_CALC_TYPE_CONFIG percentage of the share (salary_component_settings); no rule and no
 *     setting → the component is skipped. No rounding (CI stored the raw value).
 *   One row per component for the current month (START_DATE month start, END_DATE month end, calendar of
 *   the month end, financial year = the brand's Financial Year period covering the month start).
 *
 * Behaviour changes:
 *  - regenerating replaces only the current month's rows of the employee (CI hard-deleted ALL of the
 *    employee's payment rows, every period, before generating);
 *  - the financial year is the brand's (CI picked any brand's matching period);
 *  - sysadmin generates for the active brand (CI generated nothing for sysadmin but reported success);
 *  - all of a run is one transaction; benefit rules / component settings ignore deleted / disabled rows;
 *  - comments / delete only touch the active brand's rows (CI: any EP_ID); delete is a soft delete, as the
 *    CI list did (its controller delete was hard);
 *  - not ported: CI's add form (it crashed), the monthly / yearly "Sync Module" buttons (they opened a
 *    payslip PDF script without a selection / with an empty template) and their row edit / delete (wrong
 *    key / non-existent table).
 * Raw SQL: the tables' audit columns hold NULLs the Prisma models declare required.
 */

const MENU = 'systmMngt/employee_payment_details';
const CTC_CODE = 'SCCC';
const FY_TYPE_CODE = 'OPTFY';
const FREQUENCY: Record<string, string> = { annually: 'PFYLY', daily: 'PFDLY', weekly: 'PFWLY' };
const DEFAULT_FREQUENCY = 'PFMLY';

export interface GenerateResult {
  message: string;
  employees: number;
  rows: number;
  skippedNoComponents: boolean;
}

/** Period share of the yearly gross for the brand's pay frequency (CI getSalaryByComp). */
export function periodShare(gross: number, frequency: string, now: Date): number {
  switch (frequency) {
    case 'annually':
      return gross;
    case 'daily':
      return gross / (12 * getDaysInMonth(now));
    case 'weekly':
      return gross / getISOWeeksInYear(now);
    default:
      return gross / 12;
  }
}

async function canManage(subject: RequestSubject): Promise<boolean> {
  return subject.adminLevel !== 0 && (await menuPolicy(MENU).check(subject, 'update'));
}

export const employeePaymentsService = {
  /** CI index(): rows of the brand (admin), the caller's own rows (user), all (sysadmin). */
  async listScope(subject: RequestSubject, query: Record<string, string>) {
    const equals: Array<{ column: string; value: number }> = [];
    const emp = Number(query.empId);
    if (Number.isInteger(emp) && emp > 0) equals.push({ column: 'EMP_ID', value: emp }); // CI index/{empId}
    if (subject.adminLevel === 1 && subject.oaBrandId) equals.push({ column: 'OABRANDID', value: subject.oaBrandId });
    if (subject.adminLevel === 0) {
      const own = await prisma.$queryRaw<Array<{ id: number }>>`
        SELECT "EMP_ID" AS id FROM emp_mst WHERE "REF_EMP_ID" = ${subject.userId} AND COALESCE("IS_DELETED", 0) = 0 LIMIT 1`;
      return { equals, in: { column: 'EMPID', values: own.map((r) => Number(r.id)) } };
    }
    return { equals };
  },

  async capabilities(subject: RequestSubject) {
    return { canGenerate: await canManage(subject) };
  },

  /** CI getAdditionalComments($id). */
  async comments(subject: RequestSubject, id: number) {
    const brand = activeBrand(subject);
    const rows = await prisma.$queryRaw<Array<{ c: string | null }>>`
      SELECT "ADDITIONAL_COMMENTS" AS c FROM employee_payment_details
      WHERE "EP_ID" = ${id} AND "OA_BRAND_ID" = ${brand} AND COALESCE("IS_DELETED", false) = false LIMIT 1`;
    if (!rows.length) throw new NotFoundError('Payment details not found.');
    return { title: 'Update Employee Payment Details', addComments: (rows[0].c ?? '').trim() };
  },

  /** CI update(): ADDITIONAL_COMMENTS only. */
  async saveComments(subject: RequestSubject, id: number, body: unknown) {
    if (!(await menuPolicy(MENU).check(subject, 'update'))) throw new ForbiddenError();
    const brand = activeBrand(subject);
    const { addComments } = z.object({ addComments: z.string().trim().max(2000).default('') }).parse(body);
    const n = await prisma.$executeRaw`
      UPDATE employee_payment_details SET "ADDITIONAL_COMMENTS" = ${addComments}, "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now()
      WHERE "EP_ID" = ${id} AND "OA_BRAND_ID" = ${brand} AND COALESCE("IS_DELETED", false) = false`;
    if (!n) throw new NotFoundError('Payment details not found.');
    return { message: 'Successfully Updated the additional comments' };
  },

  async remove(subject: RequestSubject, id: number) {
    if (!(await menuPolicy(MENU).check(subject, 'delete'))) throw new ForbiddenError();
    const brand = activeBrand(subject);
    const n = await prisma.$executeRaw`
      UPDATE employee_payment_details SET "IS_DELETED" = true, "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now()
      WHERE "EP_ID" = ${id} AND "OA_BRAND_ID" = ${brand} AND COALESCE("IS_DELETED", false) = false`;
    if (!n) throw new NotFoundError('Payment details not found.');
    return { message: 'Successfully Deleted Employee Payment Details' };
  },

  /** CI generateBulkSalary(): the current month's payment rows for every employee of the brand. */
  async generate(subject: RequestSubject, now: Date = new Date()): Promise<GenerateResult> {
    if (!(await canManage(subject))) throw new ForbiddenError('Only administrators can generate salary details.');
    const brand = activeBrand(subject);
    const [ctcId, fyTypeId, frequencyRaw] = await Promise.all([
      getMasterId(CTC_CODE),
      getMasterId(FY_TYPE_CODE),
      settingService.getValue('SSAF', brand),
    ]);
    const frequency = (frequencyRaw ?? '').trim().toLowerCase();
    const payFrequencyId = await getMasterId(FREQUENCY[frequency] ?? DEFAULT_FREQUENCY);

    const start = startOfMonth(now);
    const end = endOfMonth(now);
    const startTs = format(start, 'yyyy-MM-dd 00:00:00');
    const endTs = format(end, 'yyyy-MM-dd 00:00:00');
    const monthEnd = format(end, 'yyyy-MM-dd');

    const [members, calendar, fy, employees, cfp, cffac] = await Promise.all([
      prisma.$queryRaw<Array<{ type_id: number; head: number | null }>>`
        SELECT "TYPE_ID" AS type_id, "COMPONENT_TYPE_ID" AS head FROM salarycomponentmember
        WHERE "COMPONENT_ID" = ${ctcId} AND "OA_BRAND_ID" = ${brand} AND "IS_ENABLED" = 1 AND COALESCE("IS_DELETED", 0) = 0
        ORDER BY "COMPONENT_MEMBER_CAL_SEQ"`,
      prisma.$queryRaw<Array<{ id: number; y: number; m: number; w: number }>>`
        SELECT "CALENDAR_ID" AS id, "YEAR" AS y, "MONTH" AS m, "WEEK" AS w FROM calendar WHERE "DB_DATE" = ${monthEnd}::date LIMIT 1`,
      prisma.$queryRaw<Array<{ id: number }>>`
        SELECT "PERIOD_ID" AS id FROM period_mst
        WHERE "PERIOD_TYPE_ID" = ${fyTypeId} AND "OA_BRAND_ID" = ${brand} AND COALESCE("IS_DELETED", 0) = 0
          AND ${format(start, 'yyyy-MM-dd')}::date BETWEEN "PERIOD_START_DATE" AND "PERIOD_END_DATE"
        ORDER BY "PERIOD_ID" LIMIT 1`,
      prisma.$queryRaw<Array<{ emp_id: number; user_id: number | null; oa_id: number | null }>>`
        SELECT DISTINCT ON ("EMP_ID") "EMP_ID" AS emp_id, "REF_EMP_ID" AS user_id, "OA_ID" AS oa_id
        FROM emp_mst WHERE "OA_BRAND_ID" = ${brand} AND COALESCE("IS_DELETED", 0) = 0 ORDER BY "EMP_ID"`,
      getMasterId('CFP'),
      getMasterId('CFFAC'),
    ]);

    if (!members.length) {
      return {
        message: 'No salary details were generated: no Cost to Company salary components are configured for this brand.',
        employees: employees.length,
        rows: 0,
        skippedNoComponents: true,
      };
    }

    const empIds = employees.map((e) => Number(e.emp_id));
    const componentIds = members.map((m) => Number(m.type_id));
    const [grossRows, rules, settings] = await Promise.all([
      prisma.$queryRaw<Array<{ emp_id: number; gross: number | null }>>`
        SELECT DISTINCT ON ("EMP_ID") "EMP_ID" AS emp_id, "EMP_GROSS_SALARY" AS gross FROM job_mst
        WHERE "EMP_ID" = ANY(${empIds}::int[]) AND COALESCE("IS_DELETED", 0) = 0 ORDER BY "EMP_ID"`,
      prisma.$queryRaw<Array<{ component: number; lower: number | null; factor: number | null; value: string | null }>>`
        SELECT "COMPONENT_ID" AS component, "LOWER_LIMIT"::float8 AS lower, "CALCULATION_FACTOR" AS factor, "VALUES" AS value
        FROM pay_component_benefit_rules
        WHERE "COMPONENT_ID" = ANY(${componentIds}::int[]) AND "OA_BRAND_ID" = ${brand}
          AND COALESCE("IS_DELETED", 0) = 0 AND COALESCE("IS_DISABLE", 0) = 0
        ORDER BY "LOWER_LIMIT" DESC NULLS LAST`,
      prisma.$queryRaw<Array<{ component: number; config: number | null }>>`
        SELECT DISTINCT ON ("COMPONENT_ID") "COMPONENT_ID" AS component, "COMPONENT_CALC_TYPE_CONFIG" AS config
        FROM salary_component_settings
        WHERE "COMPONENT_ID" = ANY(${componentIds}::int[]) AND "OA_BRAND_ID" = ${brand} AND COALESCE("IS_DELETED", 0) = 0
        ORDER BY "COMPONENT_ID", "SC_ID"`,
    ]);
    const grossOf = new Map(grossRows.map((r) => [Number(r.emp_id), r.gross === null ? null : Math.trunc(Number(r.gross))]));
    const configOf = new Map(settings.map((s) => [Number(s.component), Number(s.config ?? 0)]));

    /** CI getSalaryByComp(): null = no amount for this component. */
    const amountFor = (component: number, gross: number): number | null => {
      const share = periodShare(gross, frequency, now);
      const rule = rules.find((r) => Number(r.component) === component && (r.lower ?? 0) <= gross);
      if (rule) {
        const v = Number.parseFloat(rule.value ?? '') || 0;
        if (rule.factor === cfp) return (share * v) / 100;
        if (rule.factor === cffac) return v;
      }
      return configOf.has(component) ? (share * configOf.get(component)!) / 100 : null;
    };

    await assertInsertSafe('employee_payment_details', 'EP_ID');
    const oaFallback = await brandOrgId(brand, subject.oaId);
    const cal = calendar[0] ?? null;
    const fyId = fy[0]?.id ?? null;

    const rows = await prisma.$transaction(
      async (tx) => {
        let written = 0;
        for (const e of employees) {
          const empId = Number(e.emp_id);
          await tx.$executeRaw`
            DELETE FROM employee_payment_details
            WHERE "EMP_ID" = ${empId} AND "OA_BRAND_ID" = ${brand} AND "START_DATE" = ${startTs}::timestamp`;
          const gross = grossOf.get(empId);
          if (gross === null || gross === undefined || gross === 0) continue; // CI: no gross → no amounts
          for (const m of members) {
            const amount = amountFor(Number(m.type_id), gross);
            if (amount === null) continue;
            await tx.$executeRaw`
              INSERT INTO employee_payment_details ("EMP_ID", "FINANCIAL_YEAR_ID", "CALENDAR_ID", "BENEFIT_ID", "PAY_FREQUENCY",
                "CALENDAR_YEAR", "CALENDAR_MONTH", "CALENDAR_WEEK", "START_DATE", "END_DATE", "ACTUAL_AMOUNT", "EARNED_AMOUNT",
                "PAY_GROUP_HEAD_ID", "ADDITIONAL_COMMENTS", "OA_ID", "OA_BRAND_ID", "USER_ID", "CREATED_BY", "CREATED_ON")
              VALUES (${empId}, ${fyId}, ${cal?.id ?? null}, ${Number(m.type_id)}, ${payFrequencyId},
                ${cal?.y ?? start.getFullYear()}, ${cal?.m ?? start.getMonth() + 1}, ${cal?.w ?? null}, ${startTs}::timestamp, ${endTs}::timestamp,
                ${amount}, ${amount}, ${m.head}, ' ', ${e.oa_id ?? oaFallback}, ${brand}, ${e.user_id}, ${subject.userId}, now())`;
            written++;
          }
        }
        return written;
      },
      { timeout: 120_000 },
    );

    return { message: 'Successfully Generated Salary', employees: employees.length, rows, skippedNoComponents: false };
  },
};
