import type { RequestSubject } from '@/lib/auth/getSubject';
import { created, ok } from '@/lib/http/respond';
import { readJson, readQuery, withApi } from '@/lib/http/withApi';
import type { ListResult, ResourcePermissions } from '@/lib/resource';

/**
 * Route factories for the user-administration services whose create/update are multi-table
 * (custom) while list/read/delete reuse ResourceService. Same response contract as
 * lib/resource collectionRoutes/itemRoutes.
 */
export interface CustomResourceService<TRow> {
  list(subject: RequestSubject, query: Record<string, string>): Promise<ListResult<TRow>>;
  permissions(subject: RequestSubject): Promise<ResourcePermissions>;
  get(subject: RequestSubject, id: string): Promise<TRow>;
  remove(subject: RequestSubject, id: string): Promise<{ id: number }>;
  create(subject: RequestSubject, body: unknown): Promise<TRow>;
  update(subject: RequestSubject, id: string, body: unknown): Promise<TRow>;
}

export function customCollectionRoutes<TRow>(service: CustomResourceService<TRow>) {
  return {
    GET: withApi(async ({ req, subject }) => {
      const [result, permissions] = await Promise.all([service.list(subject, readQuery(req)), service.permissions(subject)]);
      return ok(result.rows, { total: result.total, page: result.page, limit: result.limit, permissions });
    }),
    POST: withApi(async ({ req, subject }) => created(await service.create(subject, await readJson(req)))),
  };
}

export function customItemRoutes<TRow>(service: CustomResourceService<TRow>) {
  return {
    GET: withApi<{ id: string }>(async ({ params, subject }) => service.get(subject, params.id)),
    PUT: withApi<{ id: string }>(async ({ req, params, subject }) => service.update(subject, params.id, await readJson(req))),
    DELETE: withApi<{ id: string }>(async ({ params, subject }) => service.remove(subject, params.id)),
  };
}
