import { NotFoundError } from '@/lib/http/errors';
import { ok } from '@/lib/http/respond';
import { readQuery, withApi } from '@/lib/http/withApi';
import { fyMonthlyReport, REPORT_KINDS, type ReportKind } from '@/lib/payroll/reports/fyMonthly';

/**
 * CI emp_sal_component_dtl professionalTax / MonthlyGrossReport / MonthlyNetReport — GET /api/payroll/reports/{pt|gross|net}
 * ?fy=&emp=: one row per employee, one column per month of the financial year, with totals.
 */
export const GET = withApi<{ kind: string }>(async ({ req, params, subject }) => {
  const kind = REPORT_KINDS.find((k) => k === params.kind) as ReportKind | undefined;
  if (!kind) throw new NotFoundError();
  return ok(await fyMonthlyReport(subject, kind, readQuery(req)));
});
