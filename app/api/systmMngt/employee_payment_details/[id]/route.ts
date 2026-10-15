import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { employeePaymentsService as svc } from '@/lib/systmMngt/employeePayments';
import { parseId } from '@/lib/systmMngt/shared';

/**
 * CI systmMngt/employee_payment_details — thin HTTP adapter (rules in lib/systmMngt/employeePayments).
 *   GET → Additional Comments (CI editEmployeePayment/{id}) · PUT { addComments } → CI update()
 *   DELETE → soft delete (the CI list's delete). The list is GET /api/listview/employee_payment_details.
 */
export const GET = withApi<{ id: string }>(async ({ params, subject }) => svc.comments(subject, parseId(params.id)));

export const PUT = withApi<{ id: string }>(async ({ req, params, subject }) => {
  const result = await svc.saveComments(subject, parseId(params.id), await readJson(req));
  return ok(result, { message: result.message });
});

export const DELETE = withApi<{ id: string }>(async ({ params, subject }) => {
  const result = await svc.remove(subject, parseId(params.id));
  return ok(result, { message: result.message });
});
