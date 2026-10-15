import { z } from 'zod';
import { ok } from '@/lib/http/respond';
import { readJson, readQuery, withApi } from '@/lib/http/withApi';
import { moduleSettingsService } from '@/lib/settingManager';
import type { ScreenQuery } from '@/lib/settingManager/moduleSettings.types';

/**
 * CI setting_manager/change_module_settings — thin HTTP adapter (no business logic here).
 *   GET  ?screen=module|CS|SS&moduleId=&funcAreaId=&settingGroupId=  → the screen (CI index → initForm)
 *   PUT  ?screen=…  { answers: { [attributeId]: string | string[] } } → save (CI update)
 *   POST ?screen=…                                                   → sync from system defaults (CI syncModuleSettings)
 */
export const dynamic = 'force-dynamic';

// CI URL segments use 0 for "not selected".
const optionalId = z.preprocess(
  (v) => (v === undefined || v === '' || v === '0' ? null : v),
  z.coerce.number().int().positive().nullable(),
);
const querySchema = z.object({
  screen: z.enum(['module', 'CS', 'SS']).default('module'),
  moduleId: optionalId,
  funcAreaId: optionalId,
  settingGroupId: optionalId,
});

const parseQuery = (raw: Record<string, string>): ScreenQuery => querySchema.parse(raw);

export const GET = withApi(async ({ req, subject }) => moduleSettingsService.load(subject, parseQuery(readQuery(req))));

export const PUT = withApi(async ({ req, subject }) => {
  const result = await moduleSettingsService.save(subject, parseQuery(readQuery(req)).screen, await readJson(req));
  return ok(result, { message: result.message });
});

export const POST = withApi(async ({ subject }) => {
  const result = await moduleSettingsService.sync(subject);
  return ok(result, { message: result.message });
});
