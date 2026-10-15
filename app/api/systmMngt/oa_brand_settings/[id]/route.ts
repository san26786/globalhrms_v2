import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { oaBrandSettingsService as svc } from '@/lib/systmMngt/oaBrandSettings';
import { parseId } from '@/lib/systmMngt/shared';

/** PUT → CI update() · DELETE → CI delete/{id} (hard delete, as CI; brand-checked). */
export const PUT = withApi<{ id: string }>(async ({ req, params, subject }) => {
  const result = await svc.save(subject, parseId(params.id), await readJson(req));
  return ok(result, { message: result.message });
});

export const DELETE = withApi<{ id: string }>(async ({ params, subject }) => {
  const result = await svc.remove(subject, parseId(params.id));
  return ok(result, { message: result.message });
});
