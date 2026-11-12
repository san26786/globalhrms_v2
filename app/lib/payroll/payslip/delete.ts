import type { HubContext, Tx } from '@/lib/employeeMngt/hub/hubEngine';
import { BusinessRuleError, NotFoundError } from '@/lib/http/errors';
import { toCents } from '../annexure/ruleMath';
import { findFinancialYear } from '../financialYear';
import { removePendingDeductions } from '../incentive';
import { breakupDeltas } from '../run/compute';
import { loadDeltaSetup } from '../run/context';
import { setPtMonth } from '../run/writer';
import { addToSalaryBreakup } from '../salaryBreakup';

/**
 * CI emp_sal_component_mst::deleteSalaryDetails (Payroll Processing row delete): the payslip and its rows go, and what
 * its generation added is taken back — the salary breakup of the financial year (the same deltas the run applied,
 * ../run/compute.ts breakupDeltas), the month's Professional Tax and the "Pending Deductions" arrear it carried to the
 * next month (unless that is already paid).
 *
 * Behaviour changes: only payslips can be deleted (CI deleted any header id, annexures included); a paid payslip
 * cannot (mark it unpaid first), nor one with a later payslip in the same financial year (their year-to-date figures
 * and tax were computed on top of it); the revert mirrors the generation exactly (CI subtracted Basic and LOP
 * truncated to whole rupees, never the incentives added to the annual salary, and missed the copied deductions); the
 * arrear row goes too. The month's breakup snapshot stays, as in CI (the next run of the month writes a newer one).
 */
export async function deletePayslip(tx: Tx, ctx: HubContext): Promise<void> {
  const id = ctx.id!;
  const [h] = await tx.$queryRaw<Array<{ emp: number; month: string | null; year: string | null; paid: number; brand: number }>>`
    SELECT h."EMP_ID" AS emp, btrim(h."MONTH") AS month, btrim(h."YEAR") AS year, h."TRANSACTION_STATUS" AS paid, em."OA_BRAND_ID" AS brand
    FROM emp_basic_sal_mst h JOIN emp_mst em ON em."EMP_ID" = h."EMP_ID"
    WHERE h."EMP_SAL_ID" = ${id} AND h."IS_DELETED" = 0
      AND h."SAL_TYPE" = (SELECT "MSTR_ID" FROM independent_mst WHERE "MSTR_CD" = 'PRSTPS' ORDER BY "MSTR_ID" LIMIT 1)
    FOR UPDATE OF h`;
  if (!h) throw new NotFoundError('Record not found.');
  if (Number(h.paid) > 0) throw new BusinessRuleError('A paid payslip cannot be deleted. Mark it unpaid first.');
  const month = Number(h.month);
  const year = Number(h.year);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) throw new BusinessRuleError('The payslip has no valid month.');
  const emp = Number(h.emp);
  const brand = Number(h.brand);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${emp}:${year * 100 + month}`}))`;

  const fy = await findFinancialYear(brand, month, year, tx);
  if (fy) {
    const [later] = await tx.$queryRaw<Array<{ month: string; year: string }>>`
      SELECT btrim(h."MONTH") AS month, btrim(h."YEAR") AS year FROM emp_basic_sal_mst h
      WHERE h."EMP_ID" = ${emp} AND h."IS_DELETED" = 0 AND h."EMP_SAL_ID" <> ${id}
        AND h."SAL_TYPE" = (SELECT "MSTR_ID" FROM independent_mst WHERE "MSTR_CD" = 'PRSTPS' ORDER BY "MSTR_ID" LIMIT 1)
        AND btrim(h."MONTH") ~ '^[0-9]{1,2}$' AND btrim(h."YEAR") ~ '^[0-9]{4}$'
        AND make_date(btrim(h."YEAR")::int, btrim(h."MONTH")::int, 1) > make_date(${year}::int, ${month}::int, 1)
        AND make_date(btrim(h."YEAR")::int, btrim(h."MONTH")::int, 1) <= ${fy.end}::date
      ORDER BY btrim(h."YEAR")::int, btrim(h."MONTH")::int LIMIT 1`;
    if (later) throw new BusinessRuleError(`Delete the employee's later payslips first (${later.month.padStart(2, '0')}/${later.year}).`);
  }

  const setup = await loadDeltaSetup(brand);
  const rows = await tx.$queryRaw<Array<{ id: number; component: number | null; amount: string | null }>>`
    SELECT "EMP_BASIC_SAL_DTL_ID" AS id, "SAL_COMP_ID" AS component, "ACTUAL_AMOUNT"::text AS amount
    FROM emp_basic_sal_dtl WHERE "SAL_MST_ID" = ${id} AND "IS_DELETED" = 0 ORDER BY "EMP_BASIC_SAL_DTL_ID"`;
  // The run writes its rows after the copied annexure rows, Incentives / Arrears first (CI too).
  const first = rows.find((r) => r.component !== null && Number(r.component) === setup.codes.PCINCARR);
  const c = setup.codes;
  const runComponents = new Set([c.PCINCARR, c.PCLOADV, c.SADVSAL, c.SCODA, c.SADVREP, c.SLOAINST, c.SCLOP, c.SCPTX, c.SCINTX]);
  const lines = rows.map((r) => {
    const component = r.component === null ? null : Number(r.component);
    const run = first ? Number(r.id) >= Number(first.id) : component !== null && runComponents.has(component);
    return { component, cents: toCents(r.amount), source: (run ? 'run' : 'copied') as 'run' | 'copied' };
  });
  if (fy) {
    const deltas = breakupDeltas(lines, setup);
    await addToSalaryBreakup(tx, emp, fy.id, deltas.run, ctx.subject.userId, -1);
    await addToSalaryBreakup(tx, emp, fy.id, deltas.copy, ctx.subject.userId, -1);
  }
  if (lines.some((l) => l.component === setup.codes.SCPTX && l.source === 'run')) {
    await setPtMonth(tx, { emp, month, year, cents: null, oa: 0, brand, user: 0, actor: ctx.subject.userId });
  }
  await removePendingDeductions(tx, { empId: emp, month, year, type: setup.masters.MACINARR, actor: ctx.subject.userId });
  await tx.$executeRaw`DELETE FROM emp_basic_sal_dtl WHERE "SAL_MST_ID" = ${id}`;
  await tx.$executeRaw`DELETE FROM emp_basic_sal_mst WHERE "EMP_SAL_ID" = ${id}`;
}
