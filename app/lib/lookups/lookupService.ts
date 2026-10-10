import { prisma } from '@/lib/prisma';
import type { RequestSubject } from '@/lib/auth/getSubject';
import {
  getCommonTypeOptionsByParent,
  getMasterOptionsByType,
  getMasterOptionsByTypeCode,
  type MasterOption,
} from '@/lib/masters/masterService';

/**
 * Dropdown data for forms — the Next.js counterpart of CI's dependent dropdown endpoints
 * (user_domain/changeOrgBrand, oa_brands/dependableUserBasedOnOrgBrand, indp_mst_data dropdown
 * builders). Organisation/brand/user options are always scoped to what the caller may act on:
 *   sysadmin → everything; admin → own organisation; user → own brand / self.
 */
export type Option = MasterOption;

export const lookupService = {
  masters: getMasterOptionsByType,
  mastersByTypeCode: getMasterOptionsByTypeCode,
  commonTypesByParent: getCommonTypeOptionsByParent,

  async organisations(subject: RequestSubject): Promise<Option[]> {
    const rows = await prisma.org_accounts.findMany({
      where: { IS_DELETED: 0, ...(subject.adminLevel === 2 ? {} : { OA_ID: subject.oaId ?? -1 }) },
      select: { OA_ID: true, OA_NM: true, OA_CD: true },
      orderBy: [{ OA_NM: 'asc' }, { OA_ID: 'asc' }],
    });
    return dedupe(rows.map((r) => ({ value: r.OA_ID, label: r.OA_NM, code: r.OA_CD })));
  },

  async brands(subject: RequestSubject, oaId?: number): Promise<Option[]> {
    const scope =
      subject.adminLevel === 2
        ? oaId
          ? { OA_ID: oaId }
          : {}
        : subject.adminLevel === 1
          ? { OA_ID: subject.oaId ?? -1 }
          : { OA_BRAND_ID: subject.oaBrandId ?? -1 };
    const rows = await prisma.oa_brands.findMany({
      where: { IS_DELETED: 0, ...scope },
      select: { OA_BRAND_ID: true, OA_BRAND_NM: true, OA_BRAND_CD: true },
      orderBy: [{ OA_BRAND_NM: 'asc' }, { OA_BRAND_ID: 'asc' }],
    });
    return dedupe(rows.map((r) => ({ value: r.OA_BRAND_ID, label: r.OA_BRAND_NM, code: r.OA_BRAND_CD })));
  },

  /** CI dependableUserBasedOnOrgBrand: active users of a brand the caller may see. */
  async users(subject: RequestSubject, brandId?: number): Promise<Option[]> {
    const targetBrand = subject.adminLevel === 2 ? brandId : subject.adminLevel === 1 ? brandId ?? subject.oaBrandId : subject.oaBrandId;
    if (subject.adminLevel === 1 && targetBrand) {
      const allowed = await prisma.oa_brands.findFirst({
        where: { OA_BRAND_ID: targetBrand, OA_ID: subject.oaId ?? -1 },
        select: { OA_BRAND_ID: true },
      });
      if (!allowed) return [];
    }
    const rows = await prisma.user_mst.findMany({
      where: {
        OR: [{ IS_DELETED: false }, { IS_DELETED: null }],
        ...(subject.adminLevel === 0 ? { USER_ID: subject.userId } : targetBrand ? { OA_BRAND_ID: targetBrand } : {}),
      },
      select: { USER_ID: true, USER_NAME: true, FIRST_NAME: true, LAST_NAME: true },
      orderBy: [{ USER_NAME: 'asc' }],
      take: 1000,
    });
    return dedupe(
      rows.map((r) => ({
        value: r.USER_ID,
        label: [r.FIRST_NAME, r.LAST_NAME].filter(Boolean).join(' ') || r.USER_NAME,
        code: r.USER_NAME,
      })),
    );
  },
};

function dedupe(options: Option[]): Option[] {
  const seen = new Set<number>();
  return options.filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)));
}
