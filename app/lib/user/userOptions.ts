import { prisma } from '@/lib/prisma';
import type { RequestSubject } from '@/lib/auth/getSubject';
import type { MasterOption } from '@/lib/masters/masterService';
import { ACTIVE_BOOL, resolveBrand, tenantWhere, type ScopeLevel } from './userScope';

/**
 * Scoped dropdown data for the user-administration forms (CI getAllUserDomain, getAllRoles,
 * getAllUsers, getAllUserGroup, user_type_role_mapping getUserType/getRole/getPermissionClass).
 * Unlike CI, roles / groups / users are always limited to one brand the caller may act on.
 */
export type Option = MasterOption;

function dedupe(options: Option[]): Option[] {
  const seen = new Set<number>();
  return options.filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)));
}

/** Master types whose options may be filtered by application (CI getUserType/getRole/getPermissionClass). */
export const APP_MASTER_TYPES = { userType: 47, role: 95, permissionClass: 49 } as const;
export type AppMasterKind = keyof typeof APP_MASTER_TYPES;

export const userOptions = {
  /** Domains in scope; `brandId` narrows to one brand (validated against the scope). */
  async domains(subject: RequestSubject, opts: { level: ScopeLevel; brandId?: number }): Promise<Option[]> {
    const brand = opts.brandId ? await resolveBrand(subject, opts.brandId) : undefined;
    const rows = await prisma.user_domain.findMany({
      where: { ...ACTIVE_BOOL, ...tenantWhere(subject, opts.level), ...(brand ? { OA_BRAND_ID: brand } : {}) },
      select: { DMN_ID: true, DMN_NM: true, OA_BRAND_ID: true },
      orderBy: [{ DMN_NM: 'asc' }, { DMN_ID: 'asc' }],
      take: 1000,
    });
    return dedupe(rows.map((r) => ({ value: r.DMN_ID, label: r.DMN_NM, code: String(r.OA_BRAND_ID) })));
  },

  /** Roles of one brand: the brand of `userId` / `domainId` (org scope) or `brandId`. */
  async roles(subject: RequestSubject, opts: { domainId?: number; brandId?: number; userId?: number }): Promise<Option[]> {
    let brand: number | null;
    if (opts.userId) {
      const user = await prisma.user_mst.findFirst({
        where: { USER_ID: opts.userId, ...ACTIVE_BOOL, ...tenantWhere(subject, 'org') },
        select: { OA_BRAND_ID: true },
      });
      if (!user) return [];
      brand = user.OA_BRAND_ID;
    } else if (opts.domainId) {
      const domain = await prisma.user_domain.findFirst({
        where: { DMN_ID: opts.domainId, ...ACTIVE_BOOL, ...tenantWhere(subject, 'org') },
        select: { OA_BRAND_ID: true },
      });
      if (!domain) return [];
      brand = domain.OA_BRAND_ID;
    } else {
      brand = await resolveBrand(subject, opts.brandId);
    }
    const rows = await prisma.role_mst.findMany({
      where: { ...ACTIVE_BOOL, OA_BRAND_ID: brand ?? -1 },
      select: { ROLE_ID: true, ROLE_NM: true, ROLE_CD: true },
      orderBy: [{ ROLE_NM: 'asc' }, { ROLE_ID: 'asc' }],
      take: 1000,
    });
    return dedupe(rows.map((r) => ({ value: r.ROLE_ID, label: r.ROLE_NM, code: r.ROLE_CD })));
  },

  /** Active users of one brand (the brand of `domainId`, or `brandId`). */
  async users(subject: RequestSubject, opts: { domainId?: number; brandId?: number }): Promise<Option[]> {
    let brand: number | null;
    if (opts.domainId) {
      const domain = await prisma.user_domain.findFirst({
        where: { DMN_ID: opts.domainId, ...ACTIVE_BOOL, ...tenantWhere(subject, 'org') },
        select: { OA_BRAND_ID: true },
      });
      if (!domain) return [];
      brand = domain.OA_BRAND_ID;
    } else {
      brand = await resolveBrand(subject, opts.brandId);
    }
    const rows = await prisma.user_mst.findMany({
      where: { ...ACTIVE_BOOL, OA_BRAND_ID: brand ?? -1 },
      select: { USER_ID: true, USER_NAME: true },
      orderBy: [{ USER_NAME: 'asc' }, { USER_ID: 'asc' }],
      take: 1000,
    });
    return dedupe(rows.map((r) => ({ value: r.USER_ID, label: r.USER_NAME, code: r.USER_NAME })));
  },

  async groups(subject: RequestSubject, opts: { brandId?: number }): Promise<Option[]> {
    const brand = await resolveBrand(subject, opts.brandId);
    const rows = await prisma.user_group.findMany({
      where: { ...ACTIVE_BOOL, OA_BRAND_ID: brand ?? -1 },
      select: { USER_GRP_ID: true, USER_GRP_NM: true },
      orderBy: [{ USER_GRP_NM: 'asc' }, { USER_GRP_ID: 'asc' }],
      take: 1000,
    });
    return dedupe(rows.map((r) => ({ value: r.USER_GRP_ID, label: r.USER_GRP_NM, code: null })));
  },

  /** CI getUserType/getRole/getPermissionClass($app_id): masters of the type WHERE APP_ID = app. */
  async appMasters(kind: AppMasterKind, appId: number): Promise<Option[]> {
    const rows = await prisma.independent_mst.findMany({
      where: { TYP_ID: APP_MASTER_TYPES[kind], APP_ID: appId, ...ACTIVE_BOOL },
      select: { MSTR_ID: true, MSTR_NM: true, MSTR_CD: true },
      orderBy: [{ SEQUENCE: 'asc' }, { MSTR_NM: 'asc' }, { MSTR_ID: 'asc' }],
    });
    return dedupe(rows.map((r) => ({ value: r.MSTR_ID, label: r.MSTR_NM, code: r.MSTR_CD })));
  },
};
