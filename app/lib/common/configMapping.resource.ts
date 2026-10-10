import { prisma } from '@/lib/prisma';
import { ConflictError, ValidationError } from '@/lib/http/errors';
import { ResourceService, menuPolicy, sysAdminOnly, type ResourceDefinition } from '@/lib/resource';
import { commonTypeNames, masterNames } from '@/lib/masters/masterService';
import { configMappingSchema, type ConfigMappingInput, type ConfigMappingKind } from '@/validations/common.schema';

/**
 * Config and Mapping — CI controllers/common/config_mapping_dtl.php + models/common/config_mapping_dtl_m.php.
 *
 * CI index($config_typ) lists config_mapping_dtl_vw filtered by CNFG_MPPNG_TYP_ID (header "Menu Item
 * Config" = 84, "GS Item Config" = 36) → `?typeId=`. Scoping (CI getTableDtl): sysadmin all, admin
 * own organisation (ORG_ACC_ID), user own rows (CREATED_BY_USER_ID).
 *
 * The form's Mapping_Type radio decides the mapping type and the source/target master types:
 *   Menu Mapping – Module : Module Function (76)        → Module Menu Item (83),     type 83
 *   Menu Mapping – Epic   : Functional Epic (77)        → Functional Menu Item (84), type 84
 *   GS Mapping            : functional area (any master)→ Global Setting Item (36),  type 36
 *   Board Type            : Requirement Type (222)      → Board Type (254),          type 254
 * Rules: source + target combination unique (checkUniqueComb; unchanged record excluded); sysadmin
 * rows are global (OA/brand NULL, model insert()).
 * Differences (documented): CI's setFormControls ended in var_dump()/die() so saving never worked;
 * CI hard-deleted, here the row is soft-deleted (IS_DELETED = 1) like the rest of the port.
 */

export interface MappingKindConfig {
  mappingTypeId: number;
  /** null = any master (GS mappings link masters of many types). */
  sourceTypeId: number | null;
  targetTypeId: number;
  label: string;
}

export const MAPPING_KINDS: Record<ConfigMappingKind, MappingKindConfig> = {
  module_menu: { mappingTypeId: 83, sourceTypeId: 76, targetTypeId: 83, label: 'Menu Mapping (Module)' },
  epic_menu: { mappingTypeId: 84, sourceTypeId: 77, targetTypeId: 84, label: 'Menu Mapping (Epic)' },
  global_setting: { mappingTypeId: 36, sourceTypeId: null, targetTypeId: 36, label: 'GS Mapping' },
  board_type: { mappingTypeId: 254, sourceTypeId: 222, targetTypeId: 254, label: 'Board Type' },
};

function kindOf(mappingTypeId: number | null | undefined): ConfigMappingKind | null {
  const entry = Object.entries(MAPPING_KINDS).find(([, v]) => v.mappingTypeId === mappingTypeId);
  return entry ? (entry[0] as ConfigMappingKind) : null;
}

export interface ConfigMappingDto {
  id: number;
  mappingKind: ConfigMappingKind | null;
  mappingTypeId: number | null;
  mappingTypeName: string | null;
  sourceId: number;
  sourceName: string | null;
  sourceCode: string | null;
  targetId: number;
  targetName: string | null;
  targetCode: string | null;
  oaBrandId: number | null;
}

async function toData(input: ConfigMappingInput) {
  const kind = MAPPING_KINDS[input.mappingKind];
  const [source, target] = await Promise.all([
    prisma.independent_mst.findFirst({
      where: { MSTR_ID: input.sourceId, ...(kind.sourceTypeId ? { TYP_ID: kind.sourceTypeId } : {}) },
      select: { MSTR_CD: true },
    }),
    prisma.independent_mst.findFirst({ where: { MSTR_ID: input.targetId, TYP_ID: kind.targetTypeId }, select: { MSTR_CD: true } }),
  ]);
  const errors: Record<string, string[]> = {};
  if (!source) errors.sourceId = ['Select a valid source entity.'];
  if (!target) errors.targetId = ['Select a valid target entity.'];
  if (Object.keys(errors).length) throw new ValidationError('Validation failed.', errors);
  return {
    SRC_ENTTY_ID: input.sourceId,
    TRGT_ENTTY_ID: input.targetId,
    CNFG_MPPNG_TYP_ID: kind.mappingTypeId,
    SRC_ENTITY_CD: source?.MSTR_CD ?? null,
    TRGT_ENTITY_CD: target?.MSTR_CD ?? null,
  };
}

/** CI checkUniqueComb: the same source → target link may exist once. */
async function assertUniqueCombination(input: ConfigMappingInput, exceptId?: number) {
  const clash = await prisma.config_mapping_dtl.findFirst({
    where: {
      SRC_ENTTY_ID: input.sourceId,
      TRGT_ENTTY_ID: input.targetId,
      IS_DELETED: 0,
      ...(exceptId ? { NOT: { CNFG_MPPNG_DTL_ID: exceptId } } : {}),
    },
    select: { CNFG_MPPNG_DTL_ID: true },
  });
  if (clash) throw new ConflictError('This Combination already exists', { targetId: ['This Combination already exists'] });
}

const definition: ResourceDefinition<ConfigMappingInput, ConfigMappingInput, ConfigMappingDto> = {
  label: 'Config mapping',
  model: 'config_mapping_dtl',
  primaryKey: 'CNFG_MPPNG_DTL_ID',
  searchFields: ['SRC_ENTITY_CD', 'TRGT_ENTITY_CD'],
  sortFields: ['CNFG_MPPNG_DTL_ID', 'SRC_ENTTY_ID', 'TRGT_ENTTY_ID', 'CNFG_MPPNG_TYP_ID', 'SRC_ENTITY_CD', 'TRGT_ENTITY_CD'],
  defaultSort: { field: 'CNFG_MPPNG_DTL_ID', dir: 'desc' },
  filters: {
    typeId: { column: 'CNFG_MPPNG_TYP_ID', parse: (raw) => (Number.isInteger(Number(raw)) ? Number(raw) : -1) },
  },
  tenancy: {
    mode: 'ci',
    scopeBy: 'org',
    orgColumn: 'OA_ID',
    brandColumn: 'OA_BRAND_ID',
    userColumn: 'USER_ID',
    ownerColumn: 'CREATED_BY',
    sysAdminRowsAreGlobal: true,
  },
  softDelete: { column: 'IS_DELETED', deleted: 1, active: 0 },
  audit: { createdBy: 'CREATED_BY', createdOn: 'CREATED_ON', updatedBy: 'UPDATED_BY', updatedOn: 'UPDATED_ON' },
  policy: menuPolicy('common/config_mapping_dtl', sysAdminOnly),
  createSchema: configMappingSchema,
  updateSchema: configMappingSchema,
  toCreateData: (i) => toData(i),
  toUpdateData: (i) => toData(i),
  hooks: {
    beforeCreate: (i) => assertUniqueCombination(i),
    beforeUpdate: (id, i) => assertUniqueCombination(i, id),
    async enrichRows(rows) {
      const [masters, types] = await Promise.all([
        masterNames(rows.flatMap((r) => [r.SRC_ENTTY_ID as number, r.TRGT_ENTTY_ID as number])),
        commonTypeNames(rows.map((r) => r.CNFG_MPPNG_TYP_ID as number | null)),
      ]);
      return rows.map((r) => ({
        ...r,
        _sourceName: masters.get(r.SRC_ENTTY_ID as number)?.name ?? null,
        _sourceCode: masters.get(r.SRC_ENTTY_ID as number)?.code ?? null,
        _targetName: masters.get(r.TRGT_ENTTY_ID as number)?.name ?? null,
        _targetCode: masters.get(r.TRGT_ENTTY_ID as number)?.code ?? null,
        _typeName: types.get(r.CNFG_MPPNG_TYP_ID as number) ?? null,
      }));
    },
  },
  toDto: (r) => ({
    id: r.CNFG_MPPNG_DTL_ID as number,
    mappingKind: kindOf(r.CNFG_MPPNG_TYP_ID as number | null),
    mappingTypeId: (r.CNFG_MPPNG_TYP_ID as number | null) ?? null,
    mappingTypeName: (r._typeName as string | null) ?? null,
    sourceId: r.SRC_ENTTY_ID as number,
    sourceName: (r._sourceName as string | null) ?? null,
    sourceCode: (r._sourceCode as string | null) ?? (r.SRC_ENTITY_CD as string | null) ?? null,
    targetId: r.TRGT_ENTTY_ID as number,
    targetName: (r._targetName as string | null) ?? null,
    targetCode: (r._targetCode as string | null) ?? (r.TRGT_ENTITY_CD as string | null) ?? null,
    oaBrandId: (r.OA_BRAND_ID as number | null) ?? null,
  }),
};

export const configMappingService = new ResourceService(definition);
