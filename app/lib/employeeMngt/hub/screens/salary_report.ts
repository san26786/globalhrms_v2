import type { SqlBuilder } from '@/lib/employeeMngt/empList';
import { salaryReportDefs } from '../defs/salary_report';
import { masterName, type HubConfig } from '../hubEngine';
import { amount, asInt, MONTH_YEAR, PAYSLIP_ALIVE, STATUS } from './payslips';

/**
 * CI employeeMngt/emp_sal_component_mst/viewMonthlySalaryReport ("Salary Report", page "Salary Bank Transfer Report"):
 * the payslips of one month with the employee's bank account and the net pay to transfer, Mark as Paid and the bank's
 * bulk-payment file (lib/payroll/salaryReport/bankTransfer.ts).
 *
 * As CI: always one month (the current one unless another is chosen), current employees unless another status is
 * chosen. Behaviour changes: the account is the one the bank file pays to — the newest live primary account (CI's list
 * showed the first primary row, deleted ones included); "Paid" / "Unpaid" (CI "Yes" / "No"); a Transaction Status filter;
 * the menu grant is checked and a normal user without an employee record sees nothing (CI showed every brand's payslips).
 */
export const PRIMARY_ACCOUNT = `(SELECT b."ACCOUNT_NO" FROM bank_dtl b WHERE b."EMP_ID" = em."EMP_ID" AND b."IS_PRIMARY" = 1
  AND btrim(COALESCE(b."IS_DELETED", '0'), '''') = '0' ORDER BY b."BANK_ID" DESC LIMIT 1)`;

/** One month (default the current one — CI), employment status (default Current), paid / unpaid. */
export function salaryReportFilter(q: Record<string, string>, sql: SqlBuilder, opts: { ignoreStatus?: boolean } = {}): string {
  const c: string[] = [];
  const status = (q.status ?? '').trim();
  if (!opts.ignoreStatus && status !== 'all') c.push(`v."EMP_STATUS_CD" = ${sql.p(STATUS.test(status) ? status : 'EMSC')}`);
  const m = MONTH_YEAR.exec((q.monthYear ?? '').trim());
  const now = new Date();
  const [mm, yyyy] = m ? [Number(m[1]), Number(m[2])] : [now.getMonth() + 1, now.getFullYear()];
  c.push(`v."MONTH_N" = ${sql.p(mm)}::int AND v."YEAR_N" = ${sql.p(yyyy)}::int`);
  if (q.paid === '1') c.push(`v."TRANSACTION_STATUS_N" > 0`);
  if (q.paid === '0') c.push(`v."TRANSACTION_STATUS_N" = 0`);
  return c.join(' AND ');
}

export const salaryReportConfig: HubConfig = {
  key: 'salary_report',
  defs: salaryReportDefs,
  table: 'emp_basic_sal_mst',
  pk: 'EMP_SAL_ID',
  empColumn: 'EMP_ID',
  alive: PAYSLIP_ALIVE,
  listColumns: `${amount('EARNED_AMOUNT')},
    CASE WHEN t."TRANSACTION_STATUS" > 0 THEN 'Paid' ELSE 'Unpaid' END AS "TRANSACTION_STATUS", t."TRANSACTION_STATUS" AS "TRANSACTION_STATUS_N",
    t."MONTH", t."YEAR", ${asInt('MONTH', '1,2')} AS "MONTH_N", ${asInt('YEAR', '4')} AS "YEAR_N",
    ${PRIMARY_ACCOUNT} AS "ACCOUNT_NO",
    ${masterName('em."EMP_STATUS_ID"')} AS "EMP_STATUS",
    (SELECT im."MSTR_CD" FROM independent_mst im WHERE im."MSTR_ID" = em."EMP_STATUS_ID" LIMIT 1) AS "EMP_STATUS_CD"`,
  search: ['ACCOUNT_NO', 'TRANSACTION_STATUS', 'EMP_STATUS'],
  sorts: ['ACCOUNT_NO', 'EARNED_AMOUNT_N', 'TRANSACTION_STATUS_N', 'EMP_STATUS'],
  defaultSort: 'v.id DESC',
  bind: {},
  deleteMode: 'hard',
  noCreate: true,
  noEdit: true,
  noDelete: true,
  messages: { created: '', updated: '', deleted: '' },
  listFilter: (q, sql) => salaryReportFilter(q, sql),
};
