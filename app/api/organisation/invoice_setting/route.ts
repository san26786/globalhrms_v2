import { ok } from '@/lib/http/respond';
import { readJson, readQuery, withApi } from '@/lib/http/withApi';
import { orderSettingsService as svc } from '@/lib/organisation/orderSettings';

/**
 * CI organisation/invoice_setting/getSpecificSetting/{settingId} — thin HTTP adapter (rules in lib/organisation/orderSettings).
 *   GET ?settingId=5569|5570 → the brand's setting (add or edit form) · PUT ?settingId=… → CI insert() / update()
 */
export const GET = withApi(async ({ req, subject }) => svc.load(subject, readQuery(req).settingId ?? ''));

export const PUT = withApi(async ({ req, subject }) => {
  const result = await svc.save(subject, readQuery(req).settingId ?? '', await readJson(req));
  return ok(result, { message: result.message });
});
