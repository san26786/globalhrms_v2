import { prisma } from '@/lib/prisma';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/http/errors';
import { adminOnly, menuPolicy, type ResourceAction } from '@/lib/resource';

/**
 * Shared access rules for the utilities screens.
 *
 *  - every screen is guarded by its CI menu entry (menuPolicy('utilities/<controller>')), falling back
 *    to "admins only" when the menu entry does not exist (CI: admin utilities);
 *  - a brand is never trusted from the client: sysadmin may pick any existing brand, an org admin only a
 *    brand of their own organisation, anyone else only their active brand.
 */

export type UtilityScreen = 'period_manager' | 'sync_company_settings' | 'export_employee' | 'import_export';

export async function authorizeScreen(
  subject: RequestSubject,
  screen: UtilityScreen,
  action: ResourceAction,
): Promise<void> {
  const allowed = await menuPolicy(`utilities/${screen}`, adminOnly).check(subject, action);
  if (!allowed) throw new ForbiddenError();
}

export function requireAdmin(subject: RequestSubject): void {
  if (subject.adminLevel < 1) throw new ForbiddenError('Only administrators can use this utility.');
}

export interface ScopedBrand {
  oaBrandId: number;
  oaId: number;
  name: string;
  code: string;
}

/** Validates that `requested` (default: the caller's active brand) exists and is within the caller's scope. */
export async function resolveBrand(subject: RequestSubject, requested?: number | null): Promise<ScopedBrand> {
  const target = requested ?? subject.oaBrandId;
  if (!target) throw new ValidationError('Please Select A Brand', { oaBrandId: ['Please Select A Brand'] });

  const brand = await prisma.oa_brands.findFirst({
    where: { OA_BRAND_ID: target, IS_DELETED: 0 },
    select: { OA_BRAND_ID: true, OA_ID: true, OA_BRAND_NM: true, OA_BRAND_CD: true },
  });
  if (!brand) throw new NotFoundError('Brand not found.');

  const inScope =
    subject.adminLevel === 2 ||
    (subject.adminLevel === 1 && subject.oaId !== null && brand.OA_ID === subject.oaId) ||
    brand.OA_BRAND_ID === subject.oaBrandId;
  // Out-of-scope brands behave like unknown ones (no information about other tenants).
  if (!inScope) throw new NotFoundError('Brand not found.');

  return { oaBrandId: brand.OA_BRAND_ID, oaId: brand.OA_ID, name: brand.OA_BRAND_NM, code: brand.OA_BRAND_CD };
}

export interface BrandListItem {
  oaBrandId: number;
  name: string;
  code: string;
  oaId: number;
  organisation: string | null;
}

/** Brands the caller may act on (sysadmin all, admin own organisation, user own brand), with the organisation name. */
export async function listScopedBrands(subject: RequestSubject): Promise<BrandListItem[]> {
  const scope =
    subject.adminLevel === 2
      ? {}
      : subject.adminLevel === 1
        ? { OA_ID: subject.oaId ?? -1 }
        : { OA_BRAND_ID: subject.oaBrandId ?? -1 };
  const rows = await prisma.oa_brands.findMany({
    where: { IS_DELETED: 0, ...scope },
    select: { OA_BRAND_ID: true, OA_BRAND_NM: true, OA_BRAND_CD: true, OA_ID: true },
    orderBy: [{ OA_BRAND_NM: 'asc' }, { OA_BRAND_ID: 'asc' }],
  });
  const orgIds = [...new Set(rows.map((r) => r.OA_ID))];
  const orgs = orgIds.length
    ? await prisma.org_accounts.findMany({ where: { OA_ID: { in: orgIds } }, select: { OA_ID: true, OA_NM: true } })
    : [];
  const orgName = new Map(orgs.map((o) => [o.OA_ID, o.OA_NM]));

  const seen = new Set<number>();
  const result: BrandListItem[] = [];
  for (const r of rows) {
    if (seen.has(r.OA_BRAND_ID)) continue; // migrated data contains duplicated rows
    seen.add(r.OA_BRAND_ID);
    result.push({
      oaBrandId: r.OA_BRAND_ID,
      name: r.OA_BRAND_NM,
      code: r.OA_BRAND_CD,
      oaId: r.OA_ID,
      organisation: orgName.get(r.OA_ID) ?? null,
    });
  }
  return result;
}
