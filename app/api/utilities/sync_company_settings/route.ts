import { readJson, withApi } from '@/lib/http/withApi';
import { syncCompanySettingsSchema } from '@/validations/utilities.schema';
import { authorizeScreen, listScopedBrands, resolveBrand, type ScopedBrand } from '@/lib/utilities/access';
import { syncCompanySettings } from '@/lib/utilities/syncCompanySettings';

/**
 * CI utilities/sync_company_settings.
 *   GET  → brands the caller may sync (sysadmin all, admin own organisation; CI listed every brand to everyone)
 *   POST { brandIds[] } → CI syncit(): add the missing oa_brand_settings rows per brand
 */
export const GET = withApi(async ({ subject }) => {
  await authorizeScreen(subject, 'sync_company_settings', 'list');
  return listScopedBrands(subject);
});

export const POST = withApi(async ({ req, subject }) => {
  await authorizeScreen(subject, 'sync_company_settings', 'create');
  const { brandIds } = syncCompanySettingsSchema.parse(await readJson(req));
  const brands: ScopedBrand[] = [];
  for (const id of brandIds) brands.push(await resolveBrand(subject, id));
  return syncCompanySettings(subject, brands);
});
