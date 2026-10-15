import { z } from 'zod';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { NotFoundError, ValidationError } from '@/lib/http/errors';
import { getMasterId } from '@/lib/masters/masterService';
import { prisma } from '@/lib/prisma';
import { invalidateBrandContext } from '@/lib/session/brandContext';
import { listScopedBrands, resolveBrand } from '@/lib/utilities/access';
import { authorize, type IdLabel } from './shared';

/**
 * CI systmMngt/oa_brand_settings — a brand's key/value settings (oa_brand_settings):
 *   "Company Settings"   COMPANY_ATTRIBUTE = 0, attributes of master type 41 (OASA)
 *   "Company Attributes" COMPANY_ATTRIBUTE = 1, attributes of master type 284 (CA) — the oa_brands tab (/ATTR)
 * A value is either a picked option of oa_settings_value_mst (IS_CUSTOM = 0, its SETTING_VALUE_ID) or
 * free text (IS_CUSTOM = 1). The Date Format attribute (OASTOADF) takes one of four formats.
 *
 * Behaviour changes:
 *  - the brand must be one the caller may manage (CI listed / edited / deleted any brand's rows by id
 *    and offered every brand of the system in the form); sysadmin: any, admin: own organisation, user: own brand;
 *  - the Date Format value is stored as text with IS_CUSTOM = 1 (CI stored the format text with the
 *    checkbox's IS_CUSTOM, so editing it later crashed looking the text up as an option id);
 *  - the "only one menu mode" rule (OASABMS / EVM / ENM: saving one of them as 1 sets the others to 0)
 *    applies only when one of those three is saved (CI ran it for ANY setting saved with value 1) and to the
 *    row's brand (CI used brand 0 for sysadmin);
 *  - the Ref field validation runs on add and edit (CI's update re-rendered a blank Add form on errors).
 * Kept: hard delete (CI); COMPANY_ATTRIBUTE is set on insert only (CI's update dropped it).
 * Raw SQL: audit columns hold NULLs the Prisma model declares required; rows are stored twice
 * (identical copies) — updates / deletes by id affect both, reads take one.
 */

const MENU = 'systmMngt/oa_brands';
const SETTINGS_TYPE_ID = 41; // CI const OASA
const ATTRIBUTES_TYPE_ID = 284; // CI const CA
const DATE_FORMAT_CODE = 'OASTOADF';
export const DATE_FORMATS = ['YY-MM-DD', 'MM-YY-DDDD', 'DD-MM-YY', 'YYYY-MM-DD'] as const;
const MENU_MODE_CODES = ['OASABMS', 'EVM', 'ENM'];

export type SettingsKind = 'settings' | 'attributes';

export interface BrandSettingValues {
  attributeId: string;
  /** Picked option id (IS_CUSTOM = 0). */
  optionId: string;
  /** Free text (IS_CUSTOM = 1) or the date format. */
  customValue: string;
  isCustom: boolean;
  brandId: string;
  refId: string;
  description: string;
  validation: string;
  isActive: boolean;
}

export interface BrandSettingInit {
  title: string;
  mode: 'add' | 'edit';
  kind: SettingsKind;
  values: BrandSettingValues;
  attributes: IdLabel[];
  options: IdLabel[];
  brands: IdLabel[];
  dateFormatAttributeId: number | null;
  dateFormats: readonly string[];
}

export function kindOf(raw: string | null | undefined): SettingsKind {
  return raw === 'ATTR' || raw === 'attributes' ? 'attributes' : 'settings';
}

async function attributeOptions(kind: SettingsKind): Promise<IdLabel[]> {
  const typeId = kind === 'attributes' ? ATTRIBUTES_TYPE_ID : SETTINGS_TYPE_ID;
  const rows = await prisma.$queryRaw<Array<{ value: number; label: string; seq: number | null }>>`
    SELECT DISTINCT ON ("MSTR_ID") "MSTR_ID" AS value, "MSTR_NM" AS label, "SEQUENCE" AS seq
    FROM independent_mst WHERE "TYP_ID" = ${typeId} AND COALESCE("IS_DELETED", false) = false
    ORDER BY "MSTR_ID"`;
  return rows
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0) || a.label.localeCompare(b.label))
    .map((r) => ({ value: Number(r.value), label: r.label }));
}

/** CI ajaxLive: every oa_settings_value_mst option (CI ignored the search term; filtered client-side). */
async function settingValueOptions(): Promise<IdLabel[]> {
  const rows = await prisma.$queryRaw<Array<{ value: number; label: string }>>`
    SELECT "SETTING_VALUE_ID" AS value, "SEETTING_VALUE_NM" AS label FROM oa_settings_value_mst
    WHERE COALESCE("IS_DELETED", 0) = 0 ORDER BY "SEETTING_VALUE_NM"`;
  return rows.map((r) => ({ value: Number(r.value), label: r.label ?? '' }));
}

interface Row {
  OAB_SETTING_ID: number;
  OABS_ATTRBUTE_ID: number | null;
  OABS_SETTING_VALUE: string | null;
  COMPANY_ATTRIBUTE: number | null;
  OA_BRAND_ID: number | null;
  REF_ID: number | null;
  DESCRIPTION: string | null;
  VALIDATION: string | null;
  IS_ACTIVE: boolean | null;
  IS_CUSTOM: number | null;
}

/** The row, if its brand is one the caller may manage. */
async function findRow(subject: RequestSubject, id: number): Promise<Row | null> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT "OAB_SETTING_ID", "OABS_ATTRBUTE_ID", "OABS_SETTING_VALUE", "COMPANY_ATTRIBUTE", "OA_BRAND_ID", "REF_ID",
           "DESCRIPTION", "VALIDATION", "IS_ACTIVE", "IS_CUSTOM"
    FROM oa_brand_settings WHERE "OAB_SETTING_ID" = ${id} AND COALESCE("IS_DELETED", 0) = 0 LIMIT 1`;
  const row = rows[0];
  if (!row) return null;
  if (row.OA_BRAND_ID === null) return null;
  if (row.OA_BRAND_ID === 0) return subject.adminLevel === 2 ? row : null; // system defaults: sysadmin only
  try {
    await resolveBrand(subject, row.OA_BRAND_ID);
    return row;
  } catch {
    return null;
  }
}

/** Brands the caller may pick (CI: every brand of the system). */
async function brandChoices(subject: RequestSubject): Promise<IdLabel[]> {
  const brands = await listScopedBrands(subject);
  return brands.map((b) => ({ value: b.oaBrandId, label: b.name }));
}

const saveSchema = z.object({
  kind: z.enum(['settings', 'attributes']).default('settings'),
  attributeId: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.coerce.number({ error: 'The Setting Value field is required.' }).int().positive('The Setting Value field is required.'),
  ),
  optionId: z.preprocess((v) => (v === '' || v == null ? null : v), z.coerce.number().int().positive().nullable()),
  customValue: z.string().trim().max(1000).default(''),
  isCustom: z.boolean().default(false),
  brandId: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.coerce.number({ error: 'The Brand field is required.' }).int().nonnegative('The Brand field is required.'),
  ),
  refId: z.preprocess(
    (v) => (v === '' || v == null ? null : v),
    z.coerce
      .number({ error: 'The Ref ID field must contain only positive numbers.' })
      .int('The Ref ID field must contain only positive numbers.')
      .positive('The Ref ID field cannot be zero or negative.')
      .nullable(),
  ),
  description: z.string().trim().max(2000).default(''),
  validation: z.string().trim().max(500).default(''),
  isActive: z.boolean().default(false),
});

const nn = (v: string) => (v === '' ? null : v);

export const oaBrandSettingsService = {
  /** CI index($brandId, $type): the brand the list shows (default: the active brand), checked. */
  async listScope(subject: RequestSubject, query: Record<string, string>) {
    const requested = Number(query.brandId) || null;
    const brand = requested ? (await resolveBrand(subject, requested)).oaBrandId : subject.oaBrandId ?? -1;
    return {
      equals: [
        { column: 'BRAND_ID', value: brand },
        { column: 'COMPANY_ATTRIBUTE', value: kindOf(query.type) === 'attributes' ? 1 : 0 },
      ],
    };
  },

  async formInit(subject: RequestSubject, id: number | null, requestedKind: SettingsKind, brandId: number | null): Promise<BrandSettingInit> {
    await authorize(subject, MENU, id ? 'update' : 'create');
    const row = id ? await findRow(subject, id) : null;
    if (id && !row) throw new NotFoundError('Setting not found.');
    // Edit: the row decides (CI took the kind from the URL).
    const kind: SettingsKind = row ? (row.COMPANY_ATTRIBUTE === 1 ? 'attributes' : 'settings') : requestedKind;
    const brand = row?.OA_BRAND_ID ?? (brandId ? (await resolveBrand(subject, brandId)).oaBrandId : subject.oaBrandId);
    const [attributes, options, brands, dateFormatAttributeId] = await Promise.all([
      attributeOptions(kind),
      settingValueOptions(),
      brandChoices(subject),
      getMasterId(DATE_FORMAT_CODE),
    ]);
    const custom = row ? row.IS_CUSTOM === 1 || !/^\d{1,9}$/.test(row.OABS_SETTING_VALUE ?? '') : false;
    const label = kind === 'attributes' ? 'Company Attributes' : 'Company Settings';
    return {
      title: row ? `Edit ${label}` : `New ${label}`,
      mode: row ? 'edit' : 'add',
      kind,
      values: {
        attributeId: row?.OABS_ATTRBUTE_ID ? String(row.OABS_ATTRBUTE_ID) : '',
        optionId: row && !custom ? row.OABS_SETTING_VALUE ?? '' : '',
        customValue: row && custom ? row.OABS_SETTING_VALUE ?? '' : '',
        isCustom: custom,
        brandId: brand != null ? String(brand) : '',
        refId: row?.REF_ID != null ? String(row.REF_ID) : '',
        description: row?.DESCRIPTION ?? '',
        validation: row?.VALIDATION ?? '',
        isActive: row ? row.IS_ACTIVE === true : true,
      },
      attributes,
      options,
      brands,
      dateFormatAttributeId,
      dateFormats: DATE_FORMATS,
    };
  },

  /** CI insert() / update() → setFormControls → model insert / update. */
  async save(subject: RequestSubject, id: number | null, body: unknown): Promise<{ message: string; id: number }> {
    await authorize(subject, MENU, id ? 'update' : 'create');
    const existing = id ? await findRow(subject, id) : null;
    if (id && !existing) throw new NotFoundError('Setting not found.');
    const v = saveSchema.parse(body);
    if (v.brandId !== 0 || subject.adminLevel !== 2) await resolveBrand(subject, v.brandId); // throws when out of scope

    const dateFormatId = await getMasterId(DATE_FORMAT_CODE);
    let value: string | null;
    let isCustom: number;
    if (v.attributeId === dateFormatId) {
      if (!DATE_FORMATS.includes(v.customValue as (typeof DATE_FORMATS)[number])) {
        throw new ValidationError('Select a date format.', { customValue: ['Select a date format.'] });
      }
      value = v.customValue;
      isCustom = 1;
    } else if (v.isCustom) {
      value = nn(v.customValue);
      isCustom = 1;
    } else {
      value = v.optionId !== null ? String(v.optionId) : null;
      isCustom = 0;
    }

    if (!existing) await assertInsertSafe('oa_brand_settings', 'OAB_SETTING_ID');
    const menuModes = await Promise.all(MENU_MODE_CODES.map((c) => getMasterId(c)));
    const isMenuMode = menuModes.includes(v.attributeId);

    const savedId = await prisma.$transaction(async (tx) => {
      // CI: the three menu modes are exclusive — saving one as "1" turns the others off.
      if (isMenuMode && value === '1') {
        await tx.$executeRaw`
          UPDATE oa_brand_settings SET "OABS_SETTING_VALUE" = '0'
          WHERE "OABS_ATTRBUTE_ID" = ANY(${menuModes.filter((m): m is number => m !== null)}::int[]) AND "OA_BRAND_ID" = ${v.brandId}`;
      }
      if (existing) {
        await tx.$executeRaw`
          UPDATE oa_brand_settings SET "OABS_ATTRBUTE_ID" = ${v.attributeId}, "OABS_SETTING_VALUE" = ${value},
            "OA_BRAND_ID" = ${v.brandId}, "IS_ACTIVE" = ${v.isActive}, "IS_CUSTOM" = ${isCustom}, "REF_ID" = ${v.refId},
            "DESCRIPTION" = ${nn(v.description)}, "VALIDATION" = ${nn(v.validation)},
            "UPDATED_ON" = now(), "UPDATED_BY" = ${subject.userId}
          WHERE "OAB_SETTING_ID" = ${existing.OAB_SETTING_ID}`;
        return existing.OAB_SETTING_ID;
      }
      const rows = await tx.$queryRaw<Array<{ id: number }>>`
        INSERT INTO oa_brand_settings ("OABS_ATTRBUTE_ID", "OABS_SETTING_VALUE", "COMPANY_ATTRIBUTE", "OA_BRAND_ID", "IS_ACTIVE",
          "IS_CUSTOM", "REF_ID", "DESCRIPTION", "VALIDATION", "CREATED_ON", "CREATED_BY")
        VALUES (${v.attributeId}, ${value}, ${v.kind === 'attributes' ? 1 : 0}, ${v.brandId}, ${v.isActive}, ${isCustom},
          ${v.refId}, ${nn(v.description)}, ${nn(v.validation)}, now(), ${subject.userId})
        RETURNING "OAB_SETTING_ID" AS id`;
      return Number(rows[0].id);
    }, { timeout: 20_000 });

    invalidateBrandContext(v.brandId);
    return { message: existing ? 'Successfully Updated Oa Brand Settings ID ' : 'Successfully Added ', id: savedId };
  },

  /** CI delete($id): hard delete — now only rows of a brand the caller may manage. */
  async remove(subject: RequestSubject, id: number): Promise<{ message: string }> {
    await authorize(subject, MENU, 'delete');
    const row = await findRow(subject, id);
    if (!row) throw new NotFoundError('Setting not found.');
    await prisma.$executeRaw`DELETE FROM oa_brand_settings WHERE "OAB_SETTING_ID" = ${id}`;
    if (row.OA_BRAND_ID != null) invalidateBrandContext(row.OA_BRAND_ID);
    return { message: 'Successfully Deleted Oa Brand Settings' };
  },
};
