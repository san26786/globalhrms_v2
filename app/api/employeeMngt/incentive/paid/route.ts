import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { markIncentives } from '@/lib/payroll/incentive';

/** CI incentive/incentive/paid · unpaid — POST { ids, paid }: flag the selected incentives Paid / Unpaid (admins). */
export const POST = withApi(async ({ req, subject }) => {
  const result = await markIncentives(subject, await readJson(req));
  return ok(result, { message: result.message });
});
