import { prisma } from '@/lib/prisma';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { getMasterOptionsByType } from '@/lib/masters/masterService';
import type { ScopedBrand } from './access';

/**
 * Sync Company Settings — port of CI utilities/sync_company_settings::syncit().
 *
 * For every selected brand × every organisation-account setting attribute (independent_mst of
 * TYP_ID 41 "OASA", not deleted, one per name like CI's GROUP BY MSTR_NM), insert the missing
 * oa_brand_settings row with CI oa_brand_settings_m::insert() defaults: value NULL, COMPANY_ATTRIBUTE 0,
 * IS_ACTIVE 0, IS_CUSTOM 0, REF_ID / DESCRIPTION / VALIDATION NULL, CREATED_ON / CREATED_BY.
 *
 * Differences from CI: one existence query + one createMany per brand, all brands in one
 * transaction (CI: one SELECT + INSERT per pair, no transaction); the result reports what was really
 * inserted per brand (CI's insert() returned nothing, so CI always flashed "Some settings failed").
 */

export const OASA_TYPE_ID = 41;

export interface BrandSyncResult {
  oaBrandId: number;
  name: string;
  inserted: number;
  alreadyPresent: number;
}

export interface SyncResult {
  attributes: number;
  brands: BrandSyncResult[];
  totalInserted: number;
  message: string;
}

export async function syncCompanySettings(subject: RequestSubject, brands: ScopedBrand[], now: Date = new Date()): Promise<SyncResult> {
  const attributes = await getMasterOptionsByType(OASA_TYPE_ID);
  const attributeIds = attributes.map((a) => a.value);

  if (!attributeIds.length || !brands.length) {
    return {
      attributes: attributeIds.length,
      brands: brands.map((b) => ({ oaBrandId: b.oaBrandId, name: b.name, inserted: 0, alreadyPresent: 0 })),
      totalInserted: 0,
      message: 'No company setting attributes are defined; nothing to sync.',
    };
  }

  await assertInsertSafe('oa_brand_settings', 'OAB_SETTING_ID');

  const results = await prisma.$transaction(
    async (tx) => {
      const out: BrandSyncResult[] = [];
      for (const brand of brands) {
        // CI check_setting_exists() counted every row (deleted ones too) — same here.
        const existing = await tx.oa_brand_settings.findMany({
          where: { OA_BRAND_ID: brand.oaBrandId, OABS_ATTRBUTE_ID: { in: attributeIds } },
          select: { OABS_ATTRBUTE_ID: true },
        });
        const present = new Set(existing.map((e) => e.OABS_ATTRBUTE_ID));
        const missing = attributeIds.filter((id) => !present.has(id));
        if (missing.length) {
          await tx.oa_brand_settings.createMany({
            data: missing.map((attributeId) => ({
              OABS_ATTRBUTE_ID: attributeId,
              OABS_SETTING_VALUE: null,
              COMPANY_ATTRIBUTE: 0,
              OA_BRAND_ID: brand.oaBrandId,
              IS_ACTIVE: false,
              IS_CUSTOM: 0,
              REF_ID: null,
              DESCRIPTION: null,
              VALIDATION: null,
              CREATED_ON: now,
              CREATED_BY: subject.userId,
              UPDATED_ON: now, // NOT NULL without default in the migrated schema
            })),
          });
        }
        out.push({
          oaBrandId: brand.oaBrandId,
          name: brand.name,
          inserted: missing.length,
          alreadyPresent: attributeIds.length - missing.length,
        });
      }
      return out;
    },
    { timeout: 60_000 },
  );

  const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
  return {
    attributes: attributeIds.length,
    brands: results,
    totalInserted,
    message: totalInserted
      ? `Company settings synced successfully (${totalInserted} setting(s) added).`
      : 'Company settings are already in sync.',
  };
}
