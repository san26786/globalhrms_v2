import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { markPayslipsPaid } from '@/lib/payroll/payslip/paid';

/** CI emp_sal_component_mst::paid — POST { ids, paid }: mark the selected payslips paid / unpaid (admins). */
export const POST = withApi(async ({ req, subject }) => {
  const result = await markPayslipsPaid(subject, await readJson(req));
  return ok(result, { message: result.message });
});
