import { ok } from '@/lib/http/respond';
import { withApi } from '@/lib/http/withApi';
import { oaBrandsService as svc } from '@/lib/systmMngt/oaBrands';
import { parseId } from '@/lib/systmMngt/shared';

/**
 * CI systmMngt/oa_brands — thin HTTP adapter (rules in lib/systmMngt/oaBrands).
 *   GET → the form (CI editOaBrands/{id}) · PUT multipart (fields + optional userfile logo) → CI update()
 *   DELETE → CI delete/{id}. The list is GET /api/listview/oa_brands.
 */
export const GET = withApi<{ id: string }>(async ({ params, subject }) => svc.formInit(subject, parseId(params.id)));

export const PUT = withApi<{ id: string }>(async ({ req, params, subject }) => {
  const result = await svc.save(subject, parseId(params.id), await req.formData());
  return ok(result, { message: result.message });
});

export const DELETE = withApi<{ id: string }>(async ({ params, subject }) => {
  const result = await svc.remove(subject, parseId(params.id));
  return ok(result, { message: result.message });
});
