import { created, ok } from '@/lib/http/respond';
import { readJson, readQuery, withApi } from '@/lib/http/withApi';
import type { ResourceService } from './resourceService';

/**
 * Route factories so a resource's API is two one-line route files:
 *
 *   // app/api/<module>/<resource>/route.ts
 *   export const { GET, POST } = collectionRoutes(glossaryService);
 *   // app/api/<module>/<resource>/[id]/route.ts
 *   export const { GET, PUT, DELETE } = itemRoutes(glossaryService);
 *
 * List response: { success, data: rows, total, page, limit, permissions }.
 */
// The row/input types are irrelevant to the HTTP adapter.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyResourceService = ResourceService<any, any, any>;

export function collectionRoutes(service: AnyResourceService) {
  return {
    GET: withApi(async ({ req, subject }) => {
      const [result, permissions] = await Promise.all([
        service.list(subject, readQuery(req)),
        service.permissions(subject),
      ]);
      return ok(result.rows, { total: result.total, page: result.page, limit: result.limit, permissions });
    }),
    POST: withApi(async ({ req, subject }) => created(await service.create(subject, await readJson(req)))),
  };
}

export function itemRoutes(service: AnyResourceService) {
  return {
    GET: withApi<{ id: string }>(async ({ params, subject }) => service.get(subject, params.id)),
    PUT: withApi<{ id: string }>(async ({ req, params, subject }) =>
      service.update(subject, params.id, await readJson(req)),
    ),
    DELETE: withApi<{ id: string }>(async ({ params, subject }) => service.remove(subject, params.id)),
  };
}
