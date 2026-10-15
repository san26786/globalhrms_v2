import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { parseId } from '@/lib/systmMngt/shared';
import { salaryComponentSettingsService as svc } from '@/lib/systmMngt/salaryComponentSettings';

/** PUT → CI update() · DELETE → CI delete/{id} (soft delete). */
export const PUT = withApi<{ id: string }>(async ({ req, params, subject }) => {
  const result = await svc.save(subject, parseId(params.id), await readJson(req));
  return ok(result, { message: result.message });
});

export const DELETE = withApi<{ id: string }>(async ({ params, subject }) => {
  const result = await svc.remove(subject, parseId(params.id));
  return ok(result, { message: result.message });
});
