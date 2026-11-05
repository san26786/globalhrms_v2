import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { advanceRepaymentService } from '@/lib/payroll/advanceSalary';

/**
 * CI advance_salary edit form's repayment grid — thin HTTP adapter (rules in lib/payroll/advanceSalary.ts).
 *   GET → the advance's instalments and totals
 *   PUT { paid: { "<REPAYMENT_ID>": true | false } } → tick instalments Paid / Unpaid
 */
export const GET = withApi<{ id: string }>(async ({ params, subject }) => ok(await advanceRepaymentService.list(subject, params.id)));

export const PUT = withApi<{ id: string }>(async ({ req, params, subject }) => {
  const result = await advanceRepaymentService.save(subject, params.id, await readJson(req));
  return ok(result, { message: result.message });
});
