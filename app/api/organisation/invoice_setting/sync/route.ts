import { ok } from '@/lib/http/respond';
import { readQuery, withApi } from '@/lib/http/withApi';
import { orderSettingsService as svc } from '@/lib/organisation/orderSettings';

/** CI organisation/invoice_setting/syncSetting/{settingId} — POST ?settingId=… (brand admins): copy the Invoice Setting. */
export const POST = withApi(async ({ req, subject }) => {
  const result = await svc.sync(subject, readQuery(req).settingId ?? '');
  return ok(result, { message: result.message });
});
