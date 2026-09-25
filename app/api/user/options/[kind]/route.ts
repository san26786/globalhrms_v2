import { z } from 'zod';
import { readQuery, withApi } from '@/lib/http/withApi';
import { NotFoundError } from '@/lib/http/errors';
import { userOptions } from '@/lib/user/userOptions';

/**
 * GET /api/user/options/{kind} — scoped dropdown data for the user-administration forms:
 *   domains?brandId=&level=org|brand   roles?userId=|domainId=|brandId=   users?domainId=|brandId=
 *   groups?brandId=                    user-types|app-roles|permission-classes?appId=
 */
const id = z.coerce.number().int().positive();
const optionalId = (v: string | undefined) => (v ? id.parse(v) : undefined);

export const GET = withApi<{ kind: string }>(async ({ req, params, subject }) => {
  const q = readQuery(req);
  switch (params.kind) {
    case 'domains':
      return userOptions.domains(subject, { level: q.level === 'brand' ? 'brand' : 'org', brandId: optionalId(q.brandId) });
    case 'roles':
      return userOptions.roles(subject, { domainId: optionalId(q.domainId), brandId: optionalId(q.brandId), userId: optionalId(q.userId) });
    case 'users':
      return userOptions.users(subject, { domainId: optionalId(q.domainId), brandId: optionalId(q.brandId) });
    case 'groups':
      return userOptions.groups(subject, { brandId: optionalId(q.brandId) });
    case 'user-types':
      return userOptions.appMasters('userType', id.parse(q.appId));
    case 'app-roles':
      return userOptions.appMasters('role', id.parse(q.appId));
    case 'permission-classes':
      return userOptions.appMasters('permissionClass', id.parse(q.appId));
    default:
      throw new NotFoundError('Unknown lookup.');
  }
});
