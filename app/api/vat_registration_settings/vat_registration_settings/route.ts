import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { vatRegistrationSettingsService as svc } from '@/lib/vatRegistrationSettings/vatRegistrationSettings';

/**
 * CI vat_registration_settings/vat_registration_settings — thin HTTP adapter (rules in lib/vatRegistrationSettings).
 *   GET → the brand's setting (add or edit form) · PUT { vat_registered, … } → CI insert() / update()
 */
export const GET = withApi(async ({ subject }) => svc.load(subject));

export const PUT = withApi(async ({ req, subject }) => {
  const result = await svc.save(subject, await readJson(req));
  return ok(result, { message: result.message });
});
