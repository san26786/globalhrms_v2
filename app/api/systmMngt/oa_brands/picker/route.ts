import { readQuery, withApi } from '@/lib/http/withApi';
import { brandPickerService, type PickerView } from '@/lib/systmMngt/brandPicker';

/**
 * GET ?view=own|partner|accountant — CI oa_brands MyDashboard / switchBrandForPartners /
 * switchBrandForAccountant: the brands the caller can switch into (rules in lib/systmMngt/brandPicker).
 */
const VIEWS = new Set<PickerView>(['own', 'partner', 'accountant']);

export const GET = withApi(async ({ req, subject }) => {
  const raw = readQuery(req).view as PickerView;
  return brandPickerService.list(subject, VIEWS.has(raw) ? raw : 'own');
});
