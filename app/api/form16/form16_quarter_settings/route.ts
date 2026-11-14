import { created, ok } from '@/lib/http/respond';
import { readJson, readQuery, withApi } from '@/lib/http/withApi';
import { form16QuarterSettingsService as svc } from '@/lib/payroll/form16/quarterSettings';

/**
 * CI form16/form16_quarter_settings — thin HTTP adapter (rules in lib/payroll/form16/quarterSettings).
 *   GET ?page&limit&search&sort&dir&cs_* → the quarter settings the caller may see
 *   POST { FINANCIAL_YEAR_ID, QUARTER_ID, START_DATE, END_DATE } → CI insert()
 */
export const GET = withApi(async ({ req, subject }) => {
  const { rows, total, page, limit, permissions } = await svc.list(subject, readQuery(req));
  return ok(rows, { total, page, limit, permissions });
});

export const POST = withApi(async ({ req, subject }) => {
  const result = await svc.create(subject, await readJson(req));
  return created(result, { message: result.message });
});
