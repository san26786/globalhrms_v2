import { prisma } from '@/lib/prisma';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { NotFoundError } from '@/lib/http/errors';
import { ResourceService, menuPolicy, readOnlyForAll, type ResourceDefinition } from '@/lib/resource';

/**
 * Last Login Details — CI systmInfoMgr/user_lst_login (list of user_last_login_dtl_vw) and
 * LastLoginDetails (single entry; without an id → the caller's latest login).
 *
 * Scoping (CI getTableDtl with org column ORG_ACC_ID and user column LAST_LOGIN_USER_ID):
 * sysadmin all, admin own organisation, user own logins. Unlike CI, opening a single entry uses the
 * same scope (CI LastLoginDetails/{id} had no ownership check). Read-only.
 * Not ported: the server-side ipstack call and the Google map (external API key in CI source);
 * the stored approximate location is shown instead.
 */
export interface LastLoginDto {
  id: number;
  userId: number;
  userName: string | null;
  lastLoginAt: string;
  ipAddress: string | null;
  location: string | null;
  userAgent: string | null;
  status: string | null;
  organisation: string | null;
  brand: string | null;
}

const definition: ResourceDefinition<never, never, LastLoginDto> = {
  label: 'Login detail',
  model: 'user_last_login_dtl',
  primaryKey: 'USER_LAST_LOGIN_DTL_ID',
  searchFields: ['LAST_LOGGED_IN_IP', 'APPRO_LOCATION', 'USER_AGENT'],
  sortFields: ['USER_LAST_LOGIN_DTL_ID', 'LAST_LOGIN_AT', 'USER_ID'],
  defaultSort: { field: 'LAST_LOGIN_AT', dir: 'desc' },
  tenancy: { mode: 'ci', scopeBy: 'org', orgColumn: 'OA_ID', brandColumn: 'OA_BRAND_ID', userColumn: 'USER_ID' },
  softDelete: { column: 'IS_DELETED', deleted: 1, active: 0 },
  policy: menuPolicy('systmInfoMgr/user_lst_login', readOnlyForAll),
  hooks: {
    async enrichRows(rows) {
      const ids = (key: string) => [...new Set(rows.map((r) => r[key] as number).filter((v) => typeof v === 'number'))];
      const [users, orgs, brands] = await Promise.all([
        prisma.user_mst.findMany({ where: { USER_ID: { in: ids('USER_ID') } }, select: { USER_ID: true, USER_NAME: true } }),
        prisma.org_accounts.findMany({ where: { OA_ID: { in: ids('OA_ID') } }, select: { OA_ID: true, OA_NM: true } }),
        prisma.oa_brands.findMany({ where: { OA_BRAND_ID: { in: ids('OA_BRAND_ID') } }, select: { OA_BRAND_ID: true, OA_BRAND_NM: true } }),
      ]);
      const u = new Map(users.map((x) => [x.USER_ID, x.USER_NAME]));
      const o = new Map(orgs.map((x) => [x.OA_ID, x.OA_NM]));
      const b = new Map(brands.map((x) => [x.OA_BRAND_ID, x.OA_BRAND_NM]));
      return rows.map((r) => ({
        ...r,
        _userName: u.get(r.USER_ID as number) ?? null,
        _org: o.get(r.OA_ID as number) ?? null,
        _brand: b.get(r.OA_BRAND_ID as number) ?? null,
      }));
    },
  },
  toDto: (r) => ({
    id: r.USER_LAST_LOGIN_DTL_ID as number,
    userId: r.USER_ID as number,
    userName: (r._userName as string | null) ?? null,
    lastLoginAt: new Date(r.LAST_LOGIN_AT as Date).toISOString(),
    ipAddress: (r.LAST_LOGGED_IN_IP as string | null) ?? null,
    location: (r.APPRO_LOCATION as string | null) ?? null,
    userAgent: (r.USER_AGENT as string | null) ?? null,
    status: (r.STATUS_MESSAGE as string | null) ?? null,
    organisation: (r._org as string | null) ?? null,
    brand: (r._brand as string | null) ?? null,
  }),
};

export const lastLoginService = new ResourceService(definition);

/** CI LastLoginDetails() without an id: the caller's own most recent login. */
export async function getMyLatestLogin(subject: RequestSubject): Promise<LastLoginDto> {
  const latest = await prisma.user_last_login_dtl.findFirst({
    where: { USER_ID: subject.userId, IS_DELETED: 0 },
    orderBy: { LAST_LOGIN_AT: 'desc' },
    select: { USER_LAST_LOGIN_DTL_ID: true },
  });
  if (!latest) throw new NotFoundError('No login has been recorded for your account yet.');
  return lastLoginService.get(subject, String(latest.USER_LAST_LOGIN_DTL_ID));
}
