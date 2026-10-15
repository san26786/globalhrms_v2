import { readQuery, withApi } from '@/lib/http/withApi';
import { salaryComponentSettingsService as svc } from '@/lib/systmMngt/salaryComponentSettings';

/** GET ?cct=&pcct= — CI getCompTypeConfig/{cct}/{pcct}/{brand} (the form's focus-out calculation). */
export const GET = withApi(async ({ req, subject }) => {
  const q = readQuery(req);
  return svc.compTypeConfig(subject, q.cct ?? '', q.pcct ?? '');
});
