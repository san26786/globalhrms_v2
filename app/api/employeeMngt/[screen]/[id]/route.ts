import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { hubFor } from '@/lib/employeeMngt/hub/registry';

/** Employee Hub record screens — read (CI edit…Dtl), update, delete one record in the caller's scope. */
export const GET = withApi<{ screen: string; id: string }>(async ({ params, subject }) => hubFor(params.screen).get(subject, params.id));

export const PUT = withApi<{ screen: string; id: string }>(async ({ req, params, subject }) => {
  const result = await hubFor(params.screen).update(subject, params.id, await readJson(req));
  return ok(result, { message: result.message });
});

export const DELETE = withApi<{ screen: string; id: string }>(async ({ params, subject }) => {
  const result = await hubFor(params.screen).remove(subject, params.id);
  return ok(result, { message: result.message });
});
