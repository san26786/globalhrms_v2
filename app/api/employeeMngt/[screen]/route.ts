import { created, ok } from '@/lib/http/respond';
import { readJson, readQuery, withApi } from '@/lib/http/withApi';
import { hubFor } from '@/lib/employeeMngt/hub/registry';

/**
 * Employee Hub record screens (CI employeeMngt/<screen>: Address, Education, Licences, …) — thin HTTP
 * adapter (rules in lib/employeeMngt/hub).
 *   GET ?emp&page&limit&search&sort&dir → the records the caller may see
 *   POST { EMP_ID, …form } → CI insert()
 */
export const GET = withApi<{ screen: string }>(async ({ req, params, subject }) => {
  const { rows, total, page, limit, permissions } = await hubFor(params.screen).list(subject, readQuery(req));
  return ok(rows, { total, page, limit, permissions });
});

export const POST = withApi<{ screen: string }>(async ({ req, params, subject }) => {
  const result = await hubFor(params.screen).create(subject, await readJson(req));
  return created(result, { message: result.message });
});
