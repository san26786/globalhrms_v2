import { ok } from '@/lib/http/respond';
import { withApi } from '@/lib/http/withApi';
import { salaryComponentSettingsService as svc } from '@/lib/systmMngt/salaryComponentSettings';

/** POST — CI sync_comp_settings ("Synced Salary Component", brand admins). GET — whether the list shows it. */
export const GET = withApi(async ({ subject }) => svc.listCapabilities(subject));

export const POST = withApi(async ({ subject }) => {
  const result = await svc.sync(subject);
  return ok(result, { message: result.message });
});
