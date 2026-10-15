import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { payComponentConfigService as svc } from '@/lib/systmMngt/payComponentConfig';

/**
 * CI systmMngt/payComponentTypeConfig — thin HTTP adapter (rules in lib/systmMngt/payComponentConfig).
 *   GET → the form · PUT { OASAPCTF, OASAPCTV, OASAPCTC, SSACONT } → CI update() · POST → CI syncDefault()
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
