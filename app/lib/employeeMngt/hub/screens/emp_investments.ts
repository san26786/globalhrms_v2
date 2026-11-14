import { prisma } from '@/lib/prisma';
import { empInvestmentsDefs } from '../defs/emp_investments';
import type { DbValue, HubConfig } from '../hubEngine';
import { financialYearOptions, keepCurrent, periodLabel } from '../hubOptions';

/**
 * CI employeeMngt/emp_investments ("Investment Details"): an employee's investment declaration header per
 * financial year (table investment_mst_declaration). Payroll's TDS reads ACTUAL_AMOUNT of the employee's
 * live row for the year.
 *
 * CI's form button "Save And Next" saves the header and opens its India tax-declaration page (the add / edit
 * pages app/(dashboard)/employeeMngt/emp_investments; the page and its nine IT-Act sections, which fill
 * TOTAL_INVESTMENT_AMOUNT / ACTUAL_AMOUNT: lib/payroll/declarations). The read-only "Investment Amount" shows
 * TOTAL_DEDUCTION_AMOUNT, as CI (never written: 0).
 * Behaviour changes: one live declaration per employee and financial year (payroll takes the first);
 * new rows start with zero amounts (CI's insert left the NOT NULL amounts out, which PostgreSQL rejects);
 * the record's financial year stays selectable on edit after the period closes; delete is a soft delete
 * (CI's row icon hard-deleted the header and orphaned its sections).
 */
export const empInvestmentsConfig: HubConfig = {
  key: 'emp_investments',
  defs: empInvestmentsDefs,
  table: 'investment_mst_declaration',
  pk: 'ID',
  empColumn: 'EMP_ID',
  alive: 't."IS_DELETED" = 0',
  listColumns: `(SELECT p."FISCAL_PERIOD_DESC" FROM period_mst p WHERE p."PERIOD_ID" = t."FY_ID" LIMIT 1) AS "FINANCIAL_YEAR_NM",
    t."TOTAL_INVESTMENT_AMOUNT", t."ACTUAL_AMOUNT"`,
  search: ['FINANCIAL_YEAR_NM'],
  sorts: ['FINANCIAL_YEAR_NM', 'TOTAL_INVESTMENT_AMOUNT', 'ACTUAL_AMOUNT'],
  bind: { financial_year_id: 'FY_ID' },
  deleteMode: 'soft',
  messages: {
    created: 'Successfully added Investment Details',
    updated: 'Successfully Updated Investment Details',
    deleted: 'Successfully Deleted Investment Details',
  },

  options: async (_subject, brand, row) => ({
    financialYears: await keepCurrent(await financialYearOptions(brand), row?.FY_ID, periodLabel),
  }),

  // CI's read-only "Investment Amount" (getInvestmentAmount: TOTAL_DEDUCTION_AMOUNT); never written back.
  read: (row, values) => {
    const amount = row.TOTAL_DEDUCTION_AMOUNT;
    values.investment_amount = amount === null || amount === undefined ? '' : String(amount);
  },

  async validate(v, check, ctx) {
    if (!v.financial_year_id || check.has('financial_year_id')) return;
    const [dup] = await prisma.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM investment_mst_declaration
      WHERE "EMP_ID" = ${ctx.employee.id} AND "FY_ID" = ${Number(v.financial_year_id)} AND "IS_DELETED" = 0 AND "ID" <> ${ctx.id ?? -1}`;
    if (dup.n) check.fail('financial_year_id', 'Investment Details for this employee and financial year already exist.');
  },

  // The amounts are filled by the declarations page; a new header starts at zero.
  extraColumns: (_v, ctx): Record<string, DbValue> =>
    ctx.id
      ? { EMP_NBR: ctx.employee.code }
      : { EMP_NBR: ctx.employee.code, TOTAL_INVESTMENT_AMOUNT: 0, ACTUAL_AMOUNT: 0, TOTAL_DEDUCTION_AMOUNT: 0 },
};
