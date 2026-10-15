import type { RequestSubject } from '@/lib/auth/getSubject';
import { prisma } from '@/lib/prisma';

/**
 * CI systmMngt/oa_brands::MyDashboard ("Organisation Brands") and switchBrandForPartners /
 * switchBrandForAccountant ("Partner Brands" / "Accountant Brands"): the brands the caller can switch
 * into. Switching itself is POST /api/header/switch-brand (lib/auth/activeBrand.resolveBrandAccess
 * re-checks it); afterwards the page goes to the dashboard.
 *
 * Lists (CI getAllOaBrands / getAllOaBrandsByPartnerID, de-duplicated — oa_brands rows are stored twice):
 *   own     sysadmin: every brand; others: their organisation's brands — only the active brand when that
 *           brand is not the organisation's primary brand (CI rule)
 *   partner sysadmin: every brand; admin: their organisation's brands + brands of client organisations
 *           (org_accounts.PARTNER_ID = their organisation); employee: brands whose oa_brands.PARTNER_ID is
 *           their organisation (CI used the organisation id from the URL — the session's here)
 *
 * Behaviour changes: deleted brands are not listed (CI listed them, and switching into one is refused);
 * after a switch the menus / permissions are the caller's own grants in that brand — CI loaded the
 * permission class of the brand's admin user (any user switching got that admin's rights).
 */

export type PickerView = 'own' | 'partner' | 'accountant';

export interface PickerBrand {
  oaBrandId: number;
  code: string;
  name: string;
  organisation: string | null;
  country: string | null;
  isActive: boolean;
  isPrimary: boolean;
  isCurrent: boolean;
}

export interface BrandPickerModel {
  title: string;
  brands: PickerBrand[];
}

interface Row {
  OA_BRAND_ID: number;
  OA_BRAND_CD: string | null;
  OA_BRAND_NM: string | null;
  org_name: string | null;
  country_nm: string | null;
  IS_ACTIVE: boolean | null;
  IS_PRIMARY: boolean | null;
}

async function query(where: 'all' | { orgIds?: number[]; partnerOf?: number; brandPartnerOf?: number; brandId?: number }): Promise<Row[]> {
  const all = where === 'all';
  const w = all ? {} : where;
  return prisma.$queryRaw<Row[]>`
    SELECT DISTINCT ON (b."OA_BRAND_ID") b."OA_BRAND_ID", b."OA_BRAND_CD", b."OA_BRAND_NM", o."OA_NM" AS org_name,
           (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = b."country" LIMIT 1) AS country_nm,
           b."IS_ACTIVE", b."IS_PRIMARY"
    FROM oa_brands b
    JOIN org_accounts o ON o."OA_ID" = b."OA_ID"
    WHERE COALESCE(b."IS_DELETED", 0) = 0
      AND (
        ${all}
        OR b."OA_ID" = ANY(${w.orgIds ?? []}::int[])
        OR (${w.partnerOf ?? null}::int IS NOT NULL AND o."PARTNER_ID" = ${w.partnerOf ?? null}::int)
        OR (${w.brandPartnerOf ?? null}::int IS NOT NULL AND b."PARTNER_ID" = ${w.brandPartnerOf ?? null}::int)
      )
      AND (${w.brandId ?? null}::int IS NULL OR b."OA_BRAND_ID" = ${w.brandId ?? null}::int)
    ORDER BY b."OA_BRAND_ID"`;
}

export const brandPickerService = {
  async list(subject: RequestSubject, view: PickerView): Promise<BrandPickerModel> {
    let rows: Row[];
    if (subject.adminLevel === 2) {
      rows = await query('all');
    } else if (view === 'own') {
      const oaId = subject.oaId ?? -1;
      // CI: a non-primary active brand sees only itself.
      const current = subject.oaBrandId
        ? await prisma.$queryRaw<Array<{ p: boolean | null }>>`
            SELECT "IS_PRIMARY" AS p FROM oa_brands WHERE "OA_BRAND_ID" = ${subject.oaBrandId} LIMIT 1`
        : [];
      const primary = current[0]?.p !== false;
      rows = await query(primary ? { orgIds: [oaId] } : { orgIds: [oaId], brandId: subject.oaBrandId ?? -1 });
    } else if (subject.adminLevel === 1) {
      rows = await query({ orgIds: [subject.oaId ?? -1], partnerOf: subject.oaId ?? -1 });
    } else {
      rows = await query({ brandPartnerOf: subject.oaId ?? -1 });
    }
    return {
      title: view === 'partner' ? 'Partner Brands' : view === 'accountant' ? 'Accountant Brands' : 'Organisation Brands',
      brands: rows
        .map((r) => ({
          oaBrandId: Number(r.OA_BRAND_ID),
          code: r.OA_BRAND_CD ?? '',
          name: r.OA_BRAND_NM ?? '',
          organisation: r.org_name,
          country: r.country_nm,
          isActive: r.IS_ACTIVE !== false,
          isPrimary: r.IS_PRIMARY === true,
          isCurrent: Number(r.OA_BRAND_ID) === subject.oaBrandId,
        }))
        .sort((a, b) => a.oaBrandId - b.oaBrandId),
    };
  },
};
