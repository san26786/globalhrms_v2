import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { form16SettingsService as svc } from '@/lib/payroll/form16/settings';

/**
 * CI form16/form16_settings ("Form-16 Setting") — thin HTTP adapter (rules in lib/payroll/form16/settings).
 *   GET → the brand's setting (add or edit form) · PUT { prefix, reg_address, … } → CI insert() / update()
 */
export const GET = withApi(async ({ subject }) => svc.load(subject));

export const PUT = withApi(async ({ req, subject }) => {
  const result = await svc.save(subject, await readJson(req));
  return ok(result, { message: result.message });
});
