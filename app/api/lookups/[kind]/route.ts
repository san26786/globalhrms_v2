import { z } from 'zod';
import { readQuery, withApi } from '@/lib/http/withApi';
import { NotFoundError } from '@/lib/http/errors';
import { lookupService } from '@/lib/lookups/lookupService';

/**
 * GET /api/lookups/{kind} — dropdown options: [{ value, label, code }].
 *   masters?typeId=3 | masters?typeCode=USQ
 *   common-types?parentTypeId=74
 *   organisations
 *   brands?oaId=
 *   users?brandId=
 */
const id = z.coerce.number().int().positive();

export const GET = withApi<{ kind: string }>(async ({ req, params, subject }) => {
  const q = readQuery(req);
  switch (params.kind) {
    case 'masters':
      if (q.typeCode) return lookupService.mastersByTypeCode(z.string().max(10).parse(q.typeCode));
      return lookupService.masters(id.parse(q.typeId));
    case 'common-types':
      return lookupService.commonTypesByParent(id.parse(q.parentTypeId));
    case 'organisations':
      return lookupService.organisations(subject);
    case 'brands':
      return lookupService.brands(subject, q.oaId ? id.parse(q.oaId) : undefined);
    case 'users':
      return lookupService.users(subject, q.brandId ? id.parse(q.brandId) : undefined);
    default:
      throw new NotFoundError('Unknown lookup.');
  }
});
