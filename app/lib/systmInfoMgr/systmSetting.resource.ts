import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { ConflictError, ValidationError } from '@/lib/http/errors';
import { ResourceService, menuPolicy, type ResourceContext, type ResourceDefinition } from '@/lib/resource';
import { commonTypeNames, masterNames } from '@/lib/masters/masterService';
import { systemSettingSchema, type SystemSettingInput } from '@/validations/systmInfoMgr.schema';

/**
 * System Setting — CI controllers/systmInfoMgr/systm_setting.php.
 *
 * Business rules preserved:
 *  - Reference Type options are common_type children of type 74; the Reference must be a master of
 *    the chosen type; System Attribute options are masters of type 3 (SSA).
 *  - A system attribute may be configured once per organisation + brand (CI
 *    checkSYSTM_ATTRBUTE_ID_OA_ID_OA_BRAND_ID_Combination) — the record being edited is excluded,
 *    which CI forgot (CI rejected every unchanged save).
 *  - List scoping: admin → own organisation (CI orgColumName = OA_ID), user → rows they created.
 *  - Org/brand/user stamped from the session; a sysadmin may target another brand.
 * Differences (documented): REF_CD is derived from the chosen reference instead of being typed;
 * CI's "Isdeleted" checkbox (which actually wrote IS_CURRENT) is exposed as "Is Current".
 */
export const SYSTEM_SETTING_REF_TYPE_PARENT = 74;
export const SYSTEM_ATTRIBUTE_TYPE_ID = 3;

export interface SystemSettingDto {
  id: number;
  refTypeId: number | null;
  refTypeName: string | null;
  refId: number | null;
  refName: string | null;
  refCode: string | null;
  attributeId: number;
  attributeName: string | null;
  attributeValueId: number | null;
  settingValue: string;
  description: string | null;
  isEnabled: boolean;
  isCurrent: boolean;
  oaId: number;
  oaBrandId: number;
  brandName: string | null;
}

async function validateReferences(input: SystemSettingInput) {
  const [refType, ref, attribute] = await Promise.all([
    prisma.common_type.findFirst({ where: { TYP_ID: input.refTypeId, PARENT_TYP_ID: SYSTEM_SETTING_REF_TYPE_PARENT }, select: { TYP_ID: true } }),
    prisma.independent_mst.findFirst({ where: { MSTR_ID: input.refId, TYP_ID: input.refTypeId }, select: { MSTR_CD: true } }),
    prisma.independent_mst.findFirst({ where: { MSTR_ID: input.attributeId, TYP_ID: SYSTEM_ATTRIBUTE_TYPE_ID }, select: { MSTR_ID: true } }),
  ]);
  const errors: Record<string, string[]> = {};
  if (!refType) errors.refTypeId = ['Select a valid reference type.'];
  if (!ref) errors.refId = ['Select a reference of the chosen type.'];
  if (!attribute) errors.attributeId = ['Select a valid system attribute.'];
  if (Object.keys(errors).length) throw new ValidationError('Validation failed.', errors);
  return { refCode: ref!.MSTR_CD ?? null };
}

async function assertUniqueCombination(attributeId: number, oaBrandId: number | null, exceptId?: number) {
  const clash = await prisma.systm_setting.findFirst({
    where: {
      SYSTM_ATTRBUTE_ID: attributeId,
      OA_BRAND_ID: oaBrandId ?? -1,
      IS_DELETED: 0,
      ...(exceptId ? { NOT: { SYSTM_SETTING_ID: exceptId } } : {}),
    },
    select: { SYSTM_SETTING_ID: true },
  });
  if (clash) {
    const message = 'Combination of System Attribute, Organisation and Brand already exists.';
    throw new ConflictError(message, { attributeId: [message] });
  }
}

/** Brand the new record will belong to (sysadmin may choose; everyone else = session brand). */
function targetBrand(input: SystemSettingInput, ctx: ResourceContext) {
  return ctx.subject.adminLevel === 2 && input.oaBrandId ? input.oaBrandId : ctx.subject.oaBrandId;
}

async function toData(input: SystemSettingInput) {
  const { refCode } = await validateReferences(input);
  return {
    REF_TYPE_ID: input.refTypeId,
    REF_ID: input.refId,
    REF_CD: refCode,
    SYSTM_ATTRBUTE_ID: input.attributeId,
    ATTRIBUTE_VALUE_ID: input.attributeValueId,
    SYSTM_SETTING_VALUE: input.settingValue ?? '',
    DESCRIPTION: input.description,
    IS_ENABLED: input.isEnabled,
    IS_CURRENT: input.isCurrent ? 1 : 0,
  };
}

const definition: ResourceDefinition<SystemSettingInput, SystemSettingInput, SystemSettingDto> = {
  label: 'System setting',
  model: 'systm_setting',
  primaryKey: 'SYSTM_SETTING_ID',
  // UPDATED_ON is NOT NULL in the Prisma schema but NULL in migrated rows (Prisma throws when it
  // reads one), and the list never shows it — so every column except UPDATED_ON is selected.
  select: Object.fromEntries(
    Object.values(Prisma.Systm_settingScalarFieldEnum)
      .filter((field) => field !== 'UPDATED_ON')
      .map((field) => [field, true as const]),
  ),
  searchFields: ['REF_CD', 'SYSTM_SETTING_VALUE', 'DESCRIPTION'],
  sortFields: ['SYSTM_SETTING_ID', 'SYSTM_ATTRBUTE_ID', 'REF_CD', 'OA_BRAND_ID'],
  defaultSort: { field: 'SYSTM_SETTING_ID', dir: 'desc' },
  tenancy: {
    mode: 'ci',
    scopeBy: 'org',
    orgColumn: 'OA_ID',
    brandColumn: 'OA_BRAND_ID',
    userColumn: 'USER_ID',
    ownerColumn: 'CREATED_BY',
    sysAdminMayChooseBrand: true,
  },
  softDelete: { column: 'IS_DELETED', deleted: 1, active: 0 },
  audit: { createdBy: 'CREATED_BY', createdOn: 'CREATED_ON', updatedBy: 'UPDATED_BY', updatedOn: 'UPDATED_ON' },
  policy: menuPolicy('systmInfoMgr/systm_setting'),
  createSchema: systemSettingSchema,
  updateSchema: systemSettingSchema,
  toCreateData: (i) => toData(i),
  toUpdateData: (i) => toData(i),
  hooks: {
    beforeCreate: (i, ctx) => assertUniqueCombination(i.attributeId, targetBrand(i, ctx)),
    beforeUpdate: (id, i, existing) => assertUniqueCombination(i.attributeId, existing.OA_BRAND_ID as number, id),
    async enrichRows(rows) {
      const [masters, types, brands] = await Promise.all([
        masterNames(rows.flatMap((r) => [r.SYSTM_ATTRBUTE_ID as number, r.REF_ID as number])),
        commonTypeNames(rows.map((r) => r.REF_TYPE_ID as number)),
        prisma.oa_brands.findMany({
          where: { OA_BRAND_ID: { in: [...new Set(rows.map((r) => r.OA_BRAND_ID as number))] } },
          select: { OA_BRAND_ID: true, OA_BRAND_NM: true },
        }),
      ]);
      const brandName = new Map(brands.map((b) => [b.OA_BRAND_ID, b.OA_BRAND_NM]));
      return rows.map((r) => ({
        ...r,
        _attributeName: masters.get(r.SYSTM_ATTRBUTE_ID as number)?.name ?? null,
        _refName: masters.get(r.REF_ID as number)?.name ?? null,
        _refTypeName: types.get(r.REF_TYPE_ID as number) ?? null,
        _brandName: brandName.get(r.OA_BRAND_ID as number) ?? null,
      }));
    },
  },
  toDto: (r) => ({
    id: r.SYSTM_SETTING_ID as number,
    refTypeId: (r.REF_TYPE_ID as number | null) ?? null,
    refTypeName: (r._refTypeName as string | null) ?? null,
    refId: (r.REF_ID as number | null) ?? null,
    refName: (r._refName as string | null) ?? null,
    refCode: (r.REF_CD as string | null) ?? null,
    attributeId: r.SYSTM_ATTRBUTE_ID as number,
    attributeName: (r._attributeName as string | null) ?? null,
    attributeValueId: (r.ATTRIBUTE_VALUE_ID as number | null) ?? null,
    settingValue: (r.SYSTM_SETTING_VALUE as string) ?? '',
    description: (r.DESCRIPTION as string | null) ?? null,
    isEnabled: r.IS_ENABLED !== false,
    isCurrent: Number(r.IS_CURRENT ?? 0) === 1,
    oaId: r.OA_ID as number,
    oaBrandId: r.OA_BRAND_ID as number,
    brandName: (r._brandName as string | null) ?? null,
  }),
};

export const systmSettingService = new ResourceService(definition);
