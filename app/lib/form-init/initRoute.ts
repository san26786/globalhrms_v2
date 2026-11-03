import type { RequestSubject } from '@/lib/auth/getSubject';
import { NotFoundError } from '@/lib/http/errors';
import { readQuery, withApi } from '@/lib/http/withApi';
import type { ResourceService } from '@/lib/resource';
import { initForm, type FormConfig } from './initForm';

/**
 * HTTP adapter for initForm, so a module's init endpoint is one line:
 *
 *   // app/api/<module>/<resource>/init/route.ts
 *   export const { GET } = initRoute(domainFormConfig);
 *
 * GET ?id=  → edit mode for that record; no id → add mode. Other query params go through
 * `parseParams` (e.g. a parent id such as ?classId=).
 */
export function initRoute<Params = Record<string, never>, Rec = unknown, Scope = unknown>(
  config: FormConfig<RequestSubject, Params, Rec, Scope>,
  parseParams: (query: Record<string, string>) => Params = () => ({}) as Params,
) {
  return {
    GET: withApi(async ({ req, subject }) => {
      const query = readQuery(req);
      const id = query.id ? Number(query.id) : null;
      if (query.id && !(Number.isInteger(id) && id! > 0)) throw new NotFoundError('Record not found.');
      return initForm(config, { id, params: parseParams(query), ctx: subject });
    }),
  };
}

/**
 * The CRUD parts of a FormConfig taken from a ResourceService: the record is read through the
 * service (same authorization and tenant scoping as GET /{id}, so an out-of-scope id is "not
 * found"), the permissions are the service's policy, the form saves to the resource's routes, and
 * the service's input schemas mark the required inputs.
 */
// The input types are irrelevant here; only the row (record) type flows through.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resourceForm<Rec>(service: ResourceService<any, any, Rec>, apiPath: string) {
  return {
    loadRecord: (id: number, args: { ctx: RequestSubject }) => service.get(args.ctx, String(id)),
    permissions: (args: { ctx: RequestSubject }) => service.permissions(args.ctx),
    actions: { apiPath },
    schema: { add: service.schemas.create, edit: service.schemas.update },
  } satisfies Pick<FormConfig<RequestSubject, unknown, Rec>, 'loadRecord' | 'permissions' | 'actions' | 'schema'>;
}
