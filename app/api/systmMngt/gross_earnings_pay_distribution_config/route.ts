import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { grossEarningsService as svc } from '@/lib/systmMngt/grossEarnings';

/**
 * CI systmMngt/gross_earnings_pay_distribution_config — thin HTTP adapter (rules in lib/systmMngt/grossEarnings).
 *   GET → the form · PUT { annually, monthly, weekly, daily } → CI update() · POST → CI syncDefault()
 */
export const GET = withApi(async ({ subject }) => svc.load(subject));

export const PUT = withApi(async ({ req, subject }) => {
  const result = await svc.save(subject, await readJson(req));
  return ok(result, { message: result.message });
});

export const POST = withApi(async ({ subject }) => {
  const result = await svc.sync(subject);
  return ok(result, { message: result.message });
});
