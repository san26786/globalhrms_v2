import { created, ok } from '@/lib/http/respond';
import { readJson, readQuery, withApi } from '@/lib/http/withApi';
import { form16QuartersService as svc } from '@/lib/payroll/form16/quarters';

/**
 * CI form16/form16_quarters — thin HTTP adapter (rules in lib/payroll/form16/quarters).
 *   GET ?form16&page&limit&search&sort&dir&cs_* → the quarters the caller may see (one Form 16's with ?form16=)
 *   POST { FORM16_ID, QUARTERS_ID, … } → CI insert($form16_id)
 */
export const GET = withApi(async ({ req, subject }) => {
  const { rows, total, page, limit, permissions } = await svc.list(subject, readQuery(req));
  return ok(rows, { total, page, limit, permissions });
});

export const POST = withApi(async ({ req, subject }) => {
  const result = await svc.create(subject, await readJson(req));
  return created(result, { message: result.message });
});
