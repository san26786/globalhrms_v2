import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { form16QuartersService as svc } from '@/lib/payroll/form16/quarters';

/** CI form16/form16_quarters — read (editform16quarterdetail), update, delete (soft) one quarter. */
export const GET = withApi<{ id: string }>(async ({ params, subject }) => svc.get(subject, params.id));

export const PUT = withApi<{ id: string }>(async ({ req, params, subject }) => {
  const result = await svc.update(subject, params.id, await readJson(req));
  return ok(result, { message: result.message });
});

export const DELETE = withApi<{ id: string }>(async ({ params, subject }) => {
  const result = await svc.remove(subject, params.id);
  return ok(result, { message: result.message });
});
