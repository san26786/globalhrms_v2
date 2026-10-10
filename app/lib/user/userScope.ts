import { prisma } from '@/lib/prisma';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { ValidationError, type FieldErrors } from '@/lib/http/errors';
import type { AccessPolicy, ResourceAction } from '@/lib/resource';

/**
 * Tenancy helpers shared by the user-administration screens.
 *
 * CI trusted the ids posted by the forms (role, group, domain, user) and listed roles / classes of
 * every brand in the dropdowns; here every referenced id is checked against the caller's scope:
 *   sysadmin (2) → anything
 *   admin    (1) → own organisation ('org') or own brand ('brand'), as each screen defines
 *   user     (0) → own brand (and, where CI said so, own rows)
 */

export type ScopeLevel = 'org' | 'brand';

/** Boolean IS_DELETED column where migrated rows may hold NULL. */
export const ACTIVE_BOOL = { OR: [{ IS_DELETED: false }, { IS_DELETED: null }] };

export function tenantWhere(subject: RequestSubject, level: ScopeLevel): { OA_ID?: number; OA_BRAND_ID?: number } {
  if (subject.adminLevel === 2) return {};
  if (level === 'org' && subject.adminLevel === 1) return { OA_ID: subject.oaId ?? -1 };
  return { OA_BRAND_ID: subject.oaBrandId ?? -1 };
}

/** Whether a record of (oaId, oaBrandId) is inside the caller's scope. */
export function inScope(subject: RequestSubject, level: ScopeLevel, row: { OA_ID: number | null; OA_BRAND_ID: number | null }) {
  const where = tenantWhere(subject, level);
  if (where.OA_ID !== undefined && row.OA_ID !== where.OA_ID) return false;
  if (where.OA_BRAND_ID !== undefined && row.OA_BRAND_ID !== where.OA_BRAND_ID) return false;
  return true;
}

/**
 * Brand a dropdown / validation should use: sysadmin → the requested brand (or own);
 * admin → the requested brand when it is inside the own organisation (else own brand);
 * user → own brand.
 */
export async function resolveBrand(subject: RequestSubject, requested?: number): Promise<number | null> {
  if (!requested || subject.adminLevel === 0) return subject.oaBrandId;
  if (subject.adminLevel === 2) return requested;
  const brand = await prisma.oa_brands.findFirst({
    where: { OA_BRAND_ID: requested, OA_ID: subject.oaId ?? -1 },
    select: { OA_BRAND_ID: true },
  });
  return brand ? brand.OA_BRAND_ID : subject.oaBrandId;
}

/** Brand a sysadmin-may-choose record is created for (mirrors ResourceService tenantStamp). */
export function createTargetBrand(subject: RequestSubject, requested?: number): number | null {
  return subject.adminLevel === 2 && requested ? requested : subject.oaBrandId;
}

export function fail(field: string, message: string): never {
  throw new ValidationError(message, { [field]: [message] });
}

/** Throws one ValidationError carrying every collected message (first message as summary). */
export function throwIfErrors(errors: FieldErrors): void {
  const entries = Object.entries(errors).filter(([, messages]) => messages.length);
  if (!entries.length) return;
  throw new ValidationError(entries[0][1][0], Object.fromEntries(entries));
}

export interface DomainRef {
  DMN_ID: number;
  DMN_NM: string;
  OA_ID: number;
  OA_BRAND_ID: number;
}

/** A non-deleted domain inside the caller's scope, or a field error. */
export async function findDomainInScope(
  subject: RequestSubject,
  domainId: number,
  level: ScopeLevel,
  field = 'domainId',
): Promise<DomainRef> {
  const domain = await prisma.user_domain.findFirst({
    where: { DMN_ID: domainId, ...ACTIVE_BOOL, ...tenantWhere(subject, level) },
    select: { DMN_ID: true, DMN_NM: true, OA_ID: true, OA_BRAND_ID: true },
  });
  if (!domain) fail(field, 'Select a valid domain.');
  return domain;
}

/** Every id must be a non-deleted role of `brandId`. Returns the error messages (empty = ok). */
export async function roleErrors(roleIds: number[], brandId: number | null): Promise<string[]> {
  if (!roleIds.length) return [];
  const rows = await prisma.role_mst.findMany({
    where: { ROLE_ID: { in: roleIds }, OA_BRAND_ID: brandId ?? -1, ...ACTIVE_BOOL },
    select: { ROLE_ID: true },
  });
  const found = new Set(rows.map((r) => r.ROLE_ID));
  return roleIds.every((id) => found.has(id)) ? [] : ['Selected role(s) do not belong to the brand of this domain.'];
}

/** Every id must be a non-deleted user of `brandId`. */
export async function memberErrors(userIds: number[], brandId: number | null): Promise<string[]> {
  if (!userIds.length) return [];
  const rows = await prisma.user_mst.findMany({
    where: { USER_ID: { in: userIds }, OA_BRAND_ID: brandId ?? -1, ...ACTIVE_BOOL },
    select: { USER_ID: true },
  });
  const found = new Set(rows.map((r) => r.USER_ID));
  return userIds.every((id) => found.has(id)) ? [] : ['Selected user(s) do not belong to the brand of this domain.'];
}

/**
 * Menu policy + "writes need an admin": a plain user (level 0) granted the menu may read, but
 * creating/deleting user-administration records (roles, users, role assignments) is an
 * escalation path CI left open — only admins may.
 */
export function adminWrites(base: AccessPolicy, opts: { allowUserUpdate?: boolean } = {}): AccessPolicy {
  return {
    async check(subject: RequestSubject, action: ResourceAction) {
      if (!(await base.check(subject, action))) return false;
      if (action === 'list' || action === 'read') return true;
      if (action === 'update' && opts.allowUserUpdate) return true;
      return subject.adminLevel >= 1;
    },
  };
}

/** Safe integer query-filter parser (non-numeric → matches nothing instead of a 500). */
export function intFilter(raw: string): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : -1;
}

/** id → display name maps for list enrichment (batch, no N+1). */
export async function nameMaps(rows: Record<string, unknown>[], keys: { user?: string[]; domain?: string; brand?: string; org?: string; role?: string; group?: string }) {
  const ids = (key?: string) =>
    key ? [...new Set(rows.map((r) => r[key]).filter((v): v is number => typeof v === 'number'))] : [];
  const userIds = [...new Set((keys.user ?? []).flatMap((k) => ids(k)))];
  const [users, domains, brands, orgs, roles, groups] = await Promise.all([
    userIds.length
      ? prisma.user_mst.findMany({ where: { USER_ID: { in: userIds } }, select: { USER_ID: true, USER_NAME: true } })
      : [],
    keys.domain ? prisma.user_domain.findMany({ where: { DMN_ID: { in: ids(keys.domain) } }, select: { DMN_ID: true, DMN_NM: true } }) : [],
    keys.brand
      ? prisma.oa_brands.findMany({ where: { OA_BRAND_ID: { in: ids(keys.brand) } }, select: { OA_BRAND_ID: true, OA_BRAND_NM: true } })
      : [],
    keys.org ? prisma.org_accounts.findMany({ where: { OA_ID: { in: ids(keys.org) } }, select: { OA_ID: true, OA_NM: true } }) : [],
    keys.role ? prisma.role_mst.findMany({ where: { ROLE_ID: { in: ids(keys.role) } }, select: { ROLE_ID: true, ROLE_NM: true } }) : [],
    keys.group
      ? prisma.user_group.findMany({ where: { USER_GRP_ID: { in: ids(keys.group) } }, select: { USER_GRP_ID: true, USER_GRP_NM: true } })
      : [],
  ]);
  return {
    user: new Map(users.map((x) => [x.USER_ID, x.USER_NAME])),
    domain: new Map(domains.map((x) => [x.DMN_ID, x.DMN_NM])),
    brand: new Map(brands.map((x) => [x.OA_BRAND_ID, x.OA_BRAND_NM])),
    org: new Map(orgs.map((x) => [x.OA_ID, x.OA_NM])),
    role: new Map(roles.map((x) => [x.ROLE_ID, x.ROLE_NM])),
    group: new Map(groups.map((x) => [x.USER_GRP_ID, x.USER_GRP_NM])),
  };
}

export const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
export const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
