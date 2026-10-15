import { ok } from '@/lib/http/respond';
import { withApi } from '@/lib/http/withApi';
import { employeePaymentsService as svc } from '@/lib/systmMngt/employeePayments';

/** GET → whether the list offers Generate · POST → CI generateBulkSalary (current month, active brand). */
export const GET = withApi(async ({ subject }) => svc.capabilities(subject));

export const POST = withApi(async ({ subject }) => {
  const result = await svc.generate(subject);
  return ok(result, { message: result.message });
});
