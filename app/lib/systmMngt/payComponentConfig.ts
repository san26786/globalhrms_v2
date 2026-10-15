import { z } from 'zod';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { BusinessRuleError, ForbiddenError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { menuPolicy } from '@/lib/resource/policies';
import { PrismaModuleSettingsRepository } from '@/lib/settingManager/moduleSettings.repository';
import { settingService } from '@/lib/settings/settingService';
import { activeBrand, authorize, brandOrgId, requireBrandAdmin } from './shared';

/**
 * CI systmMngt/payComponentTypeConfig — one form of four percentage settings stored as brand
 * setting answers (oa_brand_setting_attribute_mst, TextBox attributes):
 *   Fixed OASAPCTF · Variable OASAPCTV · Constant OASAPCTC · Contribution SSACONT.
 * Sysadmin edits the system defaults (brand 0), others their active brand.
 *
 * CI quirks kept: no "totals 100" check; these answers are NOT what the Salary Component screen
 * validates against (that reads oa_brand_settings) — CI had the same split.
 * Behaviour changes: the brand comes from the session (CI took it from the URL / posted id); a
 * normal user (is_admin 0) sees the values read-only (CI showed empty fields and a false "saved");
 * Sync refuses when no system defaults exist (CI deleted the brand's values and copied nothing).
 */

const MENU = 'systmMngt/payComponentTypeConfig';

export const PAY_COMPONENT_FIELDS = [
  { code: 'OASAPCTF', label: 'Fixed' },
  { code: 'OASAPCTV', label: 'Variable' },
  { code: 'OASAPCTC', label: 'Constant' },
  { code: 'SSACONT', label: 'Contribution' },
] as const;

export interface PercentField {
  key: string;
  label: string;
  value: string;
}

export interface PayComponentConfigModel {
  title: string;
  fields: PercentField[];
  canSave: boolean;
  canSync: boolean;
}

/** CI: sysadmin → brand 0 (system defaults), everyone else → the active brand. */
function targetBrand(subject: RequestSubject): number {
  return subject.adminLevel === 2 ? 0 : activeBrand(subject);
}

/** CI getAttributeIDByCode(code): SETTING_ATTRIBUTE_ID of the setting attribute. */
async function attributeIds(): Promise<Map<string, number>> {
  const codes = PAY_COMPONENT_FIELDS.map((f) => f.code);
  const rows = await prisma.$queryRaw<Array<{ code: string; id: number }>>`
    SELECT DISTINCT ON ("SYSTEM_SETTING_ATTRIBUTE_CD") "SYSTEM_SETTING_ATTRIBUTE_CD" AS code, "SETTING_ATTRIBUTE_ID" AS id
    FROM setting_group_attribute_mst
    WHERE "SYSTEM_SETTING_ATTRIBUTE_CD" = ANY(${codes}::text[]) AND COALESCE("IS_DELETED", 0) = 0
    ORDER BY "SYSTEM_SETTING_ATTRIBUTE_CD", "SETTING_ATTRIBUTE_ID"`;
  return new Map(rows.map((r) => [r.code, Number(r.id)]));
}

const percent = (label: string) =>
  z
    .string({ error: `The ${label} field is required.` })
    .trim()
    .min(1, `The ${label} field is required.`)
    .refine((v) => /^-?\d+(\.\d+)?$/.test(v), `The ${label} field must contain only numbers.`);

const saveSchema = z.object(Object.fromEntries(PAY_COMPONENT_FIELDS.map((f) => [f.code, percent(f.label)])));

export const payComponentConfigService = {
  async load(subject: RequestSubject): Promise<PayComponentConfigModel> {
    await authorize(subject, MENU, 'list');
    const brand = targetBrand(subject);
    const values = await Promise.all(PAY_COMPONENT_FIELDS.map((f) => settingService.getValue(f.code, brand)));
    const canUpdate = subject.adminLevel !== 0 && (await menuPolicy(MENU).check(subject, 'update'));
    return {
      title: 'Edit Pay Component Configuration',
      fields: PAY_COMPONENT_FIELDS.map((f, i) => ({ key: f.code, label: f.label, value: values[i] ?? '0' })),
      canSave: canUpdate,
      canSync: subject.adminLevel === 1 && canUpdate,
    };
  },

  /** CI update() → oa_brand_setting_attribute_mst_m::upsert for the four attributes. */
  async save(subject: RequestSubject, body: unknown): Promise<{ message: string }> {
    await authorize(subject, MENU, 'update');
    if (subject.adminLevel === 0) throw new ForbiddenError('Only administrators can change the pay component configuration.');
    const input = saveSchema.parse(body);
    const brand = targetBrand(subject);
    const ids = await attributeIds();
    const answers = PAY_COMPONENT_FIELDS.flatMap((f) => {
      const attributeId = ids.get(f.code);
      return attributeId ? [{ attributeId, value: String(input[f.code]) }] : [];
    });
    await new PrismaModuleSettingsRepository().saveAnswers({
      oaId: brand === 0 ? 0 : await brandOrgId(brand, subject.oaId),
      oaBrandId: brand,
      userId: subject.userId,
      answers,
      codeWrites: [],
    });
    return { message: 'Successfully Updated Pay Component Configuration.' };
  },

  /** CI syncDefault(): replace the brand's four answers with the system defaults (brand 0). */
  async sync(subject: RequestSubject): Promise<{ message: string; copied: number }> {
    await authorize(subject, MENU, 'update');
    requireBrandAdmin(subject);
    const brand = activeBrand(subject);
    const ids = [...(await attributeIds()).values()];
    const defaults = await prisma.oa_brand_setting_attribute_mst.findMany({
      where: { SETTING_ATTRIBUTE_ID: { in: ids }, OA_BRAND_ID: 0 },
      orderBy: { OA_BRAND_SETTING_ATTRIBUTE_ID: 'desc' },
    });
    if (!defaults.length) {
      throw new BusinessRuleError('No system default pay component configuration exists to sync from.', 'NO_DEFAULTS');
    }
    const answers = [...new Map(defaults.map((d) => [d.SETTING_ATTRIBUTE_ID!, d.SETTING_ATTRIBUTE_OPTIONS_ID ?? ''])).entries()];
    await new PrismaModuleSettingsRepository().saveAnswers({
      oaId: await brandOrgId(brand, subject.oaId),
      oaBrandId: brand,
      userId: subject.userId,
      answers: answers.map(([attributeId, value]) => ({ attributeId, value })),
      codeWrites: [],
    });
    return { message: 'Synced Module', copied: answers.length };
  },
};
