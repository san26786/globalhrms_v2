import { SALARY_BREAKUP_MONEY, salaryBreakupDefs } from '../defs/salary_breakup';
import type { HubConfig } from '../hubEngine';

/**
 * CI employeeMngt/emp_sal_component_dtl/SalaryBreakUp ("Salary Breakup", view salary_breakup_vw): each employee's
 * salary breakup of a financial year — the annexure's monthly / annual salary and CTC, and what the year's payslips
 * added up (components, LOP, Professional Tax, income tax, cumulative gross) — lib/payroll/salaryBreakup.ts.
 *
 * Behaviour changes: a Financial Year filter (CI listed every year mixed); the daily salary divides the CTC by the
 * days of the year (CI by one day less); the full name (CI dropped the middle name); id columns dropped; the menu grant
 * is checked and a normal user without an employee record sees nothing (CI showed every brand).
 */
const amount = (c: string) => `to_char(t."${c}", 'FM99999999999999990.00') AS "${c}", t."${c}" AS "${c}_N"`;
const DAILY = `round(t."CTC" / NULLIF(p."PERIOD_END_DATE" - p."PERIOD_START_DATE" + 1, 0), 2)`;

export const salaryBreakupConfig: HubConfig = {
  key: 'salary_breakup',
  defs: salaryBreakupDefs,
  table: 'salary_breakup',
  pk: 'SLB_ID',
  empColumn: 'EMP_ID',
  from: `salary_breakup t JOIN emp_mst em ON em."EMP_ID" = t."EMP_ID" LEFT JOIN period_mst p ON p."PERIOD_ID" = t."YEAR"`,
  alive: `t."IS_DELETED" = 0 AND t."BASIC" > 0`,
  listColumns: `t."YEAR" AS "FY_ID", p."FISCAL_PERIOD_DESC" AS "YEAR", to_char(p."PERIOD_START_DATE", 'YYYY-MM-DD') AS "YEAR_START",
    to_char(${DAILY}, 'FM99999999999999990.00') AS "DAILY_SALARY", ${DAILY} AS "DAILY_SALARY_N", ${SALARY_BREAKUP_MONEY.map((c) => amount(c.key)).join(', ')}`,
  search: ['YEAR'],
  sorts: ['YEAR_START', 'DAILY_SALARY_N', ...SALARY_BREAKUP_MONEY.map((c) => `${c.key}_N`)],
  defaultSort: 'v."YEAR_START" DESC NULLS LAST, v."EMP_NBR" ASC, v.id DESC',
  bind: {},
  deleteMode: 'soft',
  noCreate: true,
  noEdit: true,
  noDelete: true,
  messages: { created: '', updated: '', deleted: '' },
  // A financial year (PERIOD_ID); absent or "all": every year.
  listFilter(q, sql) {
    const fy = Number(q.fy);
    return Number.isInteger(fy) && fy > 0 ? `v."FY_ID" = ${sql.p(fy)}::int` : null;
  },
};
