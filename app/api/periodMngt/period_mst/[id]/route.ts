import { NotFoundError } from '@/lib/http/errors';
import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { periodService } from '@/lib/periodMngt';
import { parsePeriodId } from '@/lib/periodMngt/period.validator';

/**
 *   GET    → the period (form values)                       — CI editPeriod/{id}
 *   PUT    { periodTypeId, …, periodStatusId }               — CI update()
 *   DELETE → soft delete, refused while the period is in use — CI delete/{id}
 */
function idOf(raw: string): number {
  const id = parsePeriodId(raw);
  if (!id) throw new NotFoundError('Period not found.');
  return id;
}

export const GET = withApi<{ id: string }>(async ({ params, subject }) => {
  const init = await periodService.formInit(subject, idOf(params.id));
  return init.record;
});

export const PUT = withApi<{ id: string }>(async ({ req, params, subject }) => {
  const result = await periodService.save(subject, idOf(params.id), await readJson(req));
  return ok(result, { message: result.message });
});

export const DELETE = withApi<{ id: string }>(async ({ params, subject }) => {
  const result = await periodService.remove(subject, { ids: [idOf(params.id)] });
  return ok(result, { message: result.message });
});
