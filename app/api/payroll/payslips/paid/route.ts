import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { markPayslipsPaid, PAID_MENUS } from '@/lib/payroll/payslip/paid';

/**
 * CI emp_sal_component_mst::paid — POST { ids, paid, menu? }: mark the selected payslips paid / unpaid (admins with the
 * edit grant of `menu`: payroll_processing (default) or salary_report).
 */
export const POST = withApi(async ({ req, subject }) => {
  const body = (await readJson(req)) as { menu?: unknown } | null;
  const key = typeof body?.menu === 'string' && Object.prototype.hasOwnProperty.call(PAID_MENUS, body.menu) ? body.menu : 'payroll_processing';
  const result = await markPayslipsPaid(subject, body, { menu: PAID_MENUS[key] });
  return ok(result, { message: result.message });
});
