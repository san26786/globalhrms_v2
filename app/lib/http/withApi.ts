import type { NextRequest } from 'next/server';
import { requireSubject, type RequestSubject } from '@/lib/auth/getSubject';
import { ok, toErrorResponse } from './respond';

/**
 * Route-handler wrappers used by every new API route.
 *
 *   export const GET = withApi(async ({ subject, params, req }) => service.list(...));
 *
 * - `withApi` authenticates (401 when there is no valid access token); `withPublicApi` does not
 * - both await Next 16's async `params`
 * - a returned plain value is wrapped in `{ success: true, data }`; a returned Response passes through
 * - every thrown error goes through `toErrorResponse` (safe, consistent envelope, nothing internal leaked)
 */
type RouteParams = Record<string, string>;
export type RouteContext<P extends RouteParams> = { params: Promise<P> };

export interface ApiArgs<P extends RouteParams> {
  req: NextRequest;
  params: P;
  subject: RequestSubject;
}

export interface PublicApiArgs<P extends RouteParams> {
  req: NextRequest;
  params: P;
}

async function run(fn: () => Promise<unknown>): Promise<Response> {
  try {
    const result = await fn();
    return result instanceof Response ? result : ok(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export function withApi<P extends RouteParams = RouteParams>(
  handler: (args: ApiArgs<P>) => Promise<unknown>,
) {
  return (req: NextRequest, ctx: RouteContext<P>): Promise<Response> =>
    run(async () => {
      const params = (await ctx?.params) ?? ({} as P);
      const subject = await requireSubject(req);
      return handler({ req, params, subject });
    });
}

export function withPublicApi<P extends RouteParams = RouteParams>(
  handler: (args: PublicApiArgs<P>) => Promise<unknown>,
) {
  return (req: NextRequest, ctx: RouteContext<P>): Promise<Response> =>
    run(async () => {
      const params = (await ctx?.params) ?? ({} as P);
      return handler({ req, params });
    });
}

/** Parses the JSON body; a malformed body becomes an empty object (zod then reports what's missing). */
export async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

/** Parses the query string into a plain object for zod. */
export function readQuery(req: NextRequest): Record<string, string> {
  return Object.fromEntries(req.nextUrl.searchParams.entries());
}
