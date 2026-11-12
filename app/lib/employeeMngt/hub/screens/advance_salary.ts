import { BusinessRuleError } from '@/lib/http/errors';
import { getMasterId } from '@/lib/masters/masterService';
import { prisma } from '@/lib/prisma';
import { advanceSalaryDefs } from '../defs/advance_salary';
import { insertRow, softDeleteRow, type HubConfig, type HubContext, type HubOptionList, type Tx } from '../hubEngine';
import type { HubValues } from '../hubTypes';

/**
 * CI advance_salary/advance_salary ("Advance Salary"): a salary advance to an employee (table advance_salary)
 * and its repayment schedule (advance_salary_repayment, one instalment a month from the second month after
 * the disbursement month). CI payroll pays the advance as an addition in its month and deducts each unpaid
 * instalment in its month; HR ticks instalments Paid on the edit page (lib/payroll/advanceSalary.ts).
 *
 * As CI: the amount cannot exceed the employee's monthly salary (salary breakup of the month's financial
 * year); with no instalment count, one to three instalments of at most the current Basic.
 * Behaviour changes: only admins add, edit or delete (CI had no check at all; an Accountant Services user
 * could pay themself an advance); the record is the employee's, who cannot be changed on edit; Total Due /
 * Total Paid come from the ticked instalments (CI set Total Due to 0 on every edit and took the first totals
 * from the browser); instalments add up to the amount (the last one takes the rounding; CI's could miss by a
 * few paise); changing the amount, month or instalments regenerates the schedule, and is refused once an
 * instalment is paid (CI never regenerated it); an amount too large for three Basic instalments asks for the
 * instalment count (CI saved no schedule at all); one advance per employee and month (CI payroll read only
 * one); delete is soft, takes the schedule with it, and is refused once an instalment is paid (CI's row
 * delete was hard and left the schedule behind).
 */
const NUMBER = `'^-?[0-9]+(\\.[0-9]+)?$'`;
const money = (expr: string) => `CASE WHEN btrim(${expr}) ~ ${NUMBER} THEN round(btrim(${expr})::numeric, 2) END`;
const MONTH_RE = /^(0[1-9]|1[0-2])\/(\d{4})$/;
const FIRST_INSTALMENT = 2; // months after the disbursement month (CI since 2020)

const mmYyyy = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
const addMonths = (monthYear: string, n: number) => {
  const [, m, y] = MONTH_RE.exec(monthYear)!;
  return mmYyyy(new Date(Date.UTC(Number(y), Number(m) - 1 + n, 1)));
};
/** Paise → CI's text style (25000, 1666.67, 0.5). */
const rupees = (paise: number) => String(Number((paise / 100).toFixed(2)));

/** The current month and the 24 before it (CI's picker allowed no future month). */
function monthOptions(current: unknown): HubOptionList {
  const now = new Date();
  const list = Array.from({ length: 25 }, (_, i) => mmYyyy(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  const stored = typeof current === 'string' ? current.trim() : '';
  if (stored && !list.includes(stored)) list.push(stored);
  return list.map((m) => ({ value: m, label: m }));
}

/** CI check_amount: MONTHLY_SALARY of the salary breakup for the financial year holding the month (employee's brand). */
async function monthlySalary(employeeId: number, brand: number, monthYear: string): Promise<number | null> {
  const [, m, y] = MONTH_RE.exec(monthYear)!;
  const [row] = await prisma.$queryRaw<Array<{ salary: string | null }>>`
    SELECT sb."MONTHLY_SALARY"::text AS salary FROM salary_breakup sb
    WHERE sb."EMP_ID" = ${employeeId} AND COALESCE(sb."IS_DELETED", 0) = 0
      AND sb."YEAR" = (SELECT p."PERIOD_ID" FROM period_mst p
                       WHERE p."OA_BRAND_ID" = ${brand} AND p."IS_DELETED" = 0 AND p."PERIOD_TYPE_ID" = ${(await getMasterId('OPTFY')) ?? -1}
                         AND p."PERIOD_START_DATE" <= make_date(${Number(y)}::int, ${Number(m)}::int, 1)
                         AND p."PERIOD_END_DATE" >= make_date(${Number(y)}::int, ${Number(m)}::int, 1)
                       ORDER BY p."PERIOD_ID" LIMIT 1)
    ORDER BY sb."SLB_ID" LIMIT 1`;
  return row?.salary === null || row?.salary === undefined ? null : Number(row.salary);
}

/** CI getActualMonthlyAmountOfComponent(SCBS): the Basic of the employee's current annexure. */
async function currentBasic(employeeId: number): Promise<number | null> {
  const [annexure, basic] = await Promise.all([getMasterId('PRSTAX'), getMasterId('SCBS')]);
  const [row] = await prisma.$queryRaw<Array<{ amount: string | null }>>`
    SELECT ed."ACTUAL_AMOUNT"::text AS amount FROM emp_basic_sal_dtl ed JOIN emp_basic_sal_mst em ON em."EMP_SAL_ID" = ed."SAL_MST_ID"
    WHERE em."EMP_ID" = ${employeeId} AND em."SAL_TYPE" = ${annexure ?? -1} AND em."IS_CURRENT" = 1 AND em."IS_DELETED" = 0
      AND ed."IS_DELETED" = 0 AND ed."SAL_COMP_ID" = ${basic ?? -1}
    ORDER BY em."EMP_SAL_ID" DESC, ed."EMP_BASIC_SAL_DTL_ID" LIMIT 1`;
  return row?.amount ? Number(row.amount) : null;
}

async function hasPaidInstalment(id: number): Promise<boolean> {
  const [row] = await prisma.$queryRaw<Array<{ n: number }>>`
    SELECT count(*)::int AS n FROM advance_salary_repayment
    WHERE "ADVANCE_SAL_ID" = ${id} AND COALESCE("IS_DELETED", 0) = 0 AND "PAID" = 1`;
  return row.n > 0;
}

/** The schedule: n monthly instalments from the second month after the disbursement month, the last taking the rounding. */
async function generateSchedule(tx: Tx, id: number, v: HubValues, ctx: HubContext): Promise<void> {
  const n = Number(v.NO_OF_INSTALLMENTS);
  const total = Math.round(Number(v.AMOUNT) * 100);
  const base = Math.round(total / n);
  const { employee, subject } = ctx;
  for (let i = 0; i < n; i++) {
    await insertRow(tx, 'advance_salary_repayment', 'REPAYMENT_ID', {
      ADVANCE_SAL_ID: id, AMOUNT: rupees(i === n - 1 ? total - base * (n - 1) : base), MONTH_YEAR: addMonths(String(v.MONTH_YEAR), FIRST_INSTALMENT + i),
      PAID: 0, OA_ID: employee.oaId ?? 0, OA_BRAND_ID: employee.brand, USER_ID: employee.userId ?? subject.userId,
    }, subject.userId);
  }
}

/** Total Paid = the ticked instalments; Total Due = the rest of the amount (0 once every instalment is ticked). */
export async function syncAdvanceTotals(tx: Tx, id: number): Promise<void> {
  await tx.$executeRawUnsafe(
    `WITH s AS (
       SELECT COALESCE(SUM(${money('r."AMOUNT"')}) FILTER (WHERE r."PAID" = 1), 0) AS paid, count(*) AS n, count(*) FILTER (WHERE r."PAID" = 1) AS n_paid
       FROM advance_salary_repayment r WHERE r."ADVANCE_SAL_ID" = $1::int AND COALESCE(r."IS_DELETED", 0) = 0)
     UPDATE advance_salary a SET
       "TOTAL_PAID" = trim_scale(s.paid)::text,
       "TOTAL_DUE" = CASE WHEN s.n > 0 AND s.n_paid = s.n THEN '0' ELSE trim_scale(GREATEST(COALESCE(${money('a."AMOUNT"')}, 0) - s.paid, 0))::text END
     FROM s WHERE a."ADVANCE_SALARY_ID" = $1::int`,
    id,
  );
}

const LOCKED = ['AMOUNT', 'MONTH_YEAR', 'NO_OF_INSTALLMENTS'];

export const advanceSalaryConfig: HubConfig = {
  key: 'advance_salary',
  defs: advanceSalaryDefs,
  table: 'advance_salary',
  pk: 'ADVANCE_SALARY_ID',
  empColumn: 'EMP_ID',
  alive: 't."IS_DELETED" = 0',
  listColumns: `t."ADVANCE_SALARY_ID", ${money('t."AMOUNT"')} AS "AMOUNT", t."MONTH_YEAR",
    CASE WHEN t."MONTH_YEAR" ~ '^[0-9]{2}/[0-9]{4}$' THEN substr(t."MONTH_YEAR", 4, 4) || '-' || substr(t."MONTH_YEAR", 1, 2) END AS "MONTH_KEY",
    t."NO_OF_INSTALLMENTS", t."COMMENT", ${money('t."TOTAL_DUE"')} AS "TOTAL_DUE", ${money('t."TOTAL_PAID"')} AS "TOTAL_PAID"`,
  search: ['AMOUNT', 'MONTH_YEAR', 'NO_OF_INSTALLMENTS', 'COMMENT', 'TOTAL_DUE', 'TOTAL_PAID'],
  sorts: ['ADVANCE_SALARY_ID', 'AMOUNT', 'MONTH_KEY', 'NO_OF_INSTALLMENTS', 'TOTAL_DUE', 'TOTAL_PAID'],
  bind: { MONTH_YEAR: 'MONTH_YEAR', AMOUNT: 'AMOUNT', NO_OF_INSTALLMENTS: 'NO_OF_INSTALLMENTS', COMMENT: 'COMMENT', TOTAL_DUE: 'TOTAL_DUE', TOTAL_PAID: 'TOTAL_PAID' },
  deleteMode: 'soft',
  adminOnlyWrites: true,
  messages: { created: 'Successfully Added Advance Salary', updated: 'Successfully Updated Advance Salary', deleted: 'Successfully Deleted' },

  options: async (_subject, _brand, row) => ({ months: monthOptions(row?.MONTH_YEAR) }),
  defaults: async () => ({ MONTH_YEAR: mmYyyy(new Date()) }),

  async validate(v, check, ctx) {
    const changed = (name: string) => !ctx.existing || v[name] !== ctx.existing[name];
    const amountText = String(v.AMOUNT);
    const amount = Number(amountText);
    if (!check.has('AMOUNT') && amountText && changed('AMOUNT')) {
      if (!(amount > 0)) check.fail('AMOUNT', 'The Amount field must be greater than zero.');
      else if (!/^\d+(\.\d{1,2})?$/.test(amountText)) check.fail('AMOUNT', 'The Amount field can have at most 2 decimal places.');
    }
    const count = String(v.NO_OF_INSTALLMENTS);
    if (!check.has('NO_OF_INSTALLMENTS') && count && changed('NO_OF_INSTALLMENTS') && (!/^\d+$/.test(count) || Number(count) < 1 || Number(count) > 36)) {
      check.fail('NO_OF_INSTALLMENTS', 'The No Of Installments field must be a whole number from 1 to 36.');
    }

    if (ctx.id && LOCKED.some(changed) && (await hasPaidInstalment(ctx.id))) {
      for (const name of LOCKED.filter(changed)) check.fail(name, 'The amount, month and instalments cannot be changed after an instalment has been paid.');
      return;
    }
    if (['AMOUNT', 'MONTH_YEAR', 'NO_OF_INSTALLMENTS'].some((f) => check.has(f)) || !MONTH_RE.test(String(v.MONTH_YEAR))) return;
    const { employee } = ctx;

    if (changed('AMOUNT') || changed('MONTH_YEAR')) {
      const limit = await monthlySalary(employee.id, employee.brand, String(v.MONTH_YEAR));
      if (limit === null) check.fail('AMOUNT', 'No salary breakup was found for this employee for the financial year of the selected month.');
      else if (amount > limit) check.fail('AMOUNT', 'Amount Cannot Greater than Monthly Salary');
    }
    if (changed('MONTH_YEAR')) {
      const [other] = await prisma.$queryRaw<Array<{ id: number }>>`
        SELECT "ADVANCE_SALARY_ID" AS id FROM advance_salary
        WHERE "EMP_ID" = ${employee.id} AND "IS_DELETED" = 0 AND btrim("MONTH_YEAR") = ${String(v.MONTH_YEAR)} AND "ADVANCE_SALARY_ID" <> ${ctx.id ?? -1} LIMIT 1`;
      if (other) check.fail('MONTH_YEAR', 'The employee already has an advance salary for this month.');
    }
    if (check.has('AMOUNT')) return;

    // CI: no count → one to three instalments of at most the current Basic.
    if (!count) {
      const basic = await currentBasic(employee.id);
      const n = basic === null ? null : [1, 2, 3].find((k) => Math.round((amount / k) * 100) / 100 <= basic) ?? null;
      if (basic === null) check.fail('NO_OF_INSTALLMENTS', 'Enter the No Of Installments: the employee has no Basic salary in the current annexure.');
      else if (n === null) check.fail('NO_OF_INSTALLMENTS', 'Enter the No Of Installments: the amount is more than three months of Basic salary.');
      else v.NO_OF_INSTALLMENTS = String(n);
    }
    const n = Number(v.NO_OF_INSTALLMENTS);
    if (n && Math.round(amount * 100) < n) check.fail('NO_OF_INSTALLMENTS', 'The amount is too small for that many instalments.');
  },

  extraColumns: (v, ctx) => ({
    AMOUNT: String(Number(v.AMOUNT)),
    // Provisional until the schedule is written (afterWrite).
    TOTAL_PAID: ctx.existing ? String(ctx.existing.TOTAL_PAID || '0') : '0',
    TOTAL_DUE: ctx.existing ? String(ctx.existing.TOTAL_DUE || '0') : String(Number(v.AMOUNT)),
    USER_ID: ctx.employee.userId ?? ctx.subject.userId,
  }),

  async afterWrite(tx, id, v, ctx) {
    const regenerate = !ctx.existing || LOCKED.some((f) => v[f] !== ctx.existing![f]);
    if (regenerate) {
      if (ctx.existing) {
        await tx.$executeRaw`
          UPDATE advance_salary_repayment SET "IS_DELETED" = 1, "UPDATED_BY" = ${String(ctx.subject.userId)}, "UPDATED_ON" = now()
          WHERE "ADVANCE_SAL_ID" = ${id} AND COALESCE("IS_DELETED", 0) = 0`;
      }
      await generateSchedule(tx, id, v, ctx);
    }
    await syncAdvanceTotals(tx, id);
  },

  async remove(tx, ctx) {
    if (await hasPaidInstalment(ctx.id!)) throw new BusinessRuleError('An advance salary with paid instalments cannot be deleted.');
    await softDeleteRow(tx, 'advance_salary', 'ADVANCE_SALARY_ID', ctx.id!, ctx.subject.userId);
    await tx.$executeRaw`
      UPDATE advance_salary_repayment SET "IS_DELETED" = 1, "UPDATED_BY" = ${String(ctx.subject.userId)}, "UPDATED_ON" = now()
      WHERE "ADVANCE_SAL_ID" = ${ctx.id!} AND COALESCE("IS_DELETED", 0) = 0`;
  },
};
