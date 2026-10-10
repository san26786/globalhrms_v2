import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/http/errors';
import { parseListQuery } from '@/lib/resource/listQuery';
import { menuPolicy, readAllWriteAdmin } from '@/lib/resource/policies';
import type { AccessPolicy, ListResult, ResourceAction, ResourcePermissions } from '@/lib/resource/types';
import { commonTypeNames, getMasterOptionsByType, masterNames, type MasterOption } from '@/lib/masters/masterService';
import { masterDataSchema, type MasterDataInput, type MasterOptionsKind } from '@/validations/common.schema';

/**
 * Independent master data — CI controllers/common/indp_mst_data.php + models/common/indp_mst_data_m.php.
 *
 * A dedicated domain service rather than a plain ResourceDefinition because CI's rules depend on the
 * master's common type at run time (row scoping, who may add/delete, organisation code prefix) and
 * because every independent_mst / common_type row exists twice in the migrated data (lists are
 * de-duplicated by MSTR_ID with DISTINCT ON; writes use *Many so both copies stay identical).
 *
 * Business rules ported (CI → here):
 *  - index($MstrID): masters of one type; title = common_type.TYP_NM. Types whose TABLE_TYPE is not
 *    'system' are scoped for non-sysadmins (admin → OA_BRAND_ID = active brand, user → own rows);
 *    system types are visible to everyone. Without a type every row is brand-scoped (CI $Dtype empty).
 *  - Non-sysadmin + USER_CAN_CREATE_DATA = 0: no Add (addIndependentData → EMTSI00001), no Delete,
 *    no Save (initForm saveButton = false) — enforced server-side for create, update and delete.
 *  - "Sync Masters" (replicateMstrForBrandByTypeID) for non-system types.
 *  - insertIndpMstData / updateIndpMstData tenancy: system type → OA/brand/user NULL; non-sysadmin →
 *    session org/brand/user; sysadmin → the chosen brand (default: session brand).
 *  - Code = organisation-code prefix (non-system types, CI code_prefix) + UPPER(code); alpha-numeric;
 *    unique among non-deleted masters (checkCode_IsUnique, own id excluded).
 *  - Name unique per type + brand on insert (checkMasterName).
 *  - IS_EDITABLE copied from the common type; update refused for non-sysadmin when the master's
 *    IS_EDITABLE != 1 (EMTSI00002).
 *  - Delete needs the menu DELETE grant (EMTSI00003); soft delete (IS_DELETED = 1).
 *  - Sysadmin-only controls: parent master (relationship_dtl through hier_level_config, CI
 *    getDependentParentDropdown), "Link to Global Settings" and "Link to Menu" (config_mapping_dtl;
 *    menu only for Module Function / Functional Epic types, CI checkModuleEpic).
 *  - Country: location_mst LOC_TYPE_ID = 61 of the active brand, default = the brand's country.
 */

export const MODULE_TYPE_ID = 76; // CI MODULEID
export const EPIC_TYPE_ID = 77; // CI EPICID
export const MENU_FOR_MODULE_TYPE_ID = 83; // CI MENUIDFORMODULE
export const MENU_FOR_EPIC_TYPE_ID = 84; // CI MENUIDFOREPIC
export const GLOBAL_SETTINGS_TYPE_ID = 36; // CI GLOBALSETTINGSID
export const COUNTRY_LOCATION_TYPE_ID = 61; // CI COUNTRY

const NOT_DELETED = { OR: [{ IS_DELETED: false }, { IS_DELETED: null }] };
const SORT_COLUMNS: Record<string, string> = {
  MSTR_ID: 'MSTR_ID',
  MSTR_CD: 'MSTR_CD',
  MSTR_NM: 'MSTR_NM',
  SEQUENCE: 'SEQUENCE',
  TYP_ID: 'TYP_ID',
};

export interface MasterTypeInfo {
  typeId: number;
  typeCode: string;
  typeName: string;
  tableType: string | null;
  isSystem: boolean;
  userCanCreateData: boolean;
  isEditable: boolean;
  parentTypeId: number | null;
}

export interface MasterDataDto {
  id: number;
  code: string | null;
  /** The code without the organisation prefix (what the form edits). */
  codeInput: string;
  codePrefix: string;
  name: string;
  description: string | null;
  typeId: number;
  typeName: string | null;
  parentId: number | null;
  parentName: string | null;
  countryId: number | null;
  countryName: string | null;
  isEditable: boolean;
  isPredefined: boolean;
  oaBrandId: number | null;
  globalSettingId: number | null;
  menuId: number | null;
  /** Row-level actions for the caller (CI hides delete when the type forbids user data). */
  canEdit: boolean;
  canDelete: boolean;
}

export interface MasterDataMeta {
  typeId: number | null;
  title: string;
  type: MasterTypeInfo | null;
  isSysAdmin: boolean;
  /** Prefix shown before the code input for non-system types (CI code_prefix = session organisation). */
  codePrefix: string;
  defaultCountryId: number | null;
  /** CI "Sync Masters" list action. */
  canSync: boolean;
  permissions: ResourcePermissions;
}

interface MasterRow {
  MSTR_ID: number;
  MSTR_CD: string | null;
  MSTR_NM: string;
  MSTR_DESC: string | null;
  TYP_ID: number;
  PARENT_MSTR_ID: number | null;
  IS_EDITABLE: boolean | null;
  IS_PREDEFINED: boolean | null;
  COUNTRY_ID: number | null;
  OA_ID: number | null;
  OA_BRAND_ID: number | null;
  USER_ID: number | null;
}

const MASTER_SELECT = {
  MSTR_ID: true,
  MSTR_CD: true,
  MSTR_NM: true,
  MSTR_DESC: true,
  TYP_ID: true,
  PARENT_MSTR_ID: true,
  IS_EDITABLE: true,
  IS_PREDEFINED: true,
  COUNTRY_ID: true,
  OA_ID: true,
  OA_BRAND_ID: true,
  USER_ID: true,
} as const;

interface Tenant {
  oaId: number | null;
  oaBrandId: number | null;
  userId: number | null;
}

/* ------------------------------------------------------------------ helpers */

export function isSystemTableType(tableType: string | null | undefined): boolean {
  return (tableType ?? '').trim().toLowerCase() === 'system';
}

export async function loadMasterType(typeId: number): Promise<MasterTypeInfo | null> {
  const row = await prisma.common_type.findFirst({
    where: { TYP_ID: typeId },
    select: {
      TYP_ID: true,
      TYP_CD: true,
      TYP_NM: true,
      TABLE_TYPE: true,
      USER_CAN_CREATE_DATA: true,
      IS_EDITABLE: true,
      PARENT_TYP_ID: true,
    },
  });
  if (!row) return null;
  return {
    typeId: row.TYP_ID,
    typeCode: row.TYP_CD,
    typeName: row.TYP_NM,
    tableType: row.TABLE_TYPE,
    isSystem: isSystemTableType(row.TABLE_TYPE),
    userCanCreateData: row.USER_CAN_CREATE_DATA === 1,
    isEditable: row.IS_EDITABLE === true,
    parentTypeId: row.PARENT_TYP_ID,
  };
}

/** CI flash texts are masters (EMTSI0000x); fall back to a plain message when missing. */
async function ciMessage(code: string, fallback: string): Promise<string> {
  const row = await prisma.independent_mst.findFirst({ where: { MSTR_CD: code }, select: { MSTR_NM: true }, orderBy: { MSTR_ID: 'asc' } });
  return row?.MSTR_NM?.trim() || fallback;
}

async function orgCode(oaId: number | null): Promise<string> {
  if (!oaId) return '';
  const org = await prisma.org_accounts.findFirst({ where: { OA_ID: oaId }, select: { OA_CD: true } });
  return (org?.OA_CD ?? '').trim().toUpperCase();
}

function stripPrefix(code: string | null, prefix: string): string {
  const value = code ?? '';
  return prefix && value.toUpperCase().startsWith(prefix) ? value.slice(prefix.length) : value;
}

function policyFor(typeId: number | null): AccessPolicy {
  // Master screens are reached through a menu per type (CI common/indp_mst_data/index/{typeId}).
  return menuPolicy(typeId ? `common/indp_mst_data/index/${typeId}` : 'common/indp_mst_data', readAllWriteAdmin);
}

async function can(subject: RequestSubject, typeId: number | null, action: ResourceAction): Promise<boolean> {
  return policyFor(typeId).check(subject, action);
}

function dedupeOptions(options: MasterOption[]): MasterOption[] {
  const seen = new Set<number>();
  return options.filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)));
}

/**
 * Row scope of CI getTableDtl for independent_mst_vw: sysadmin and system types see everything;
 * otherwise admin → own brand, user → own rows.
 */
function scopeSql(subject: RequestSubject, type: MasterTypeInfo | null): Prisma.Sql {
  if (subject.adminLevel === 2 || type?.isSystem) return Prisma.empty;
  if (subject.adminLevel === 0) return Prisma.sql` AND im."USER_ID" = ${subject.userId}`;
  return Prisma.sql` AND im."OA_BRAND_ID" = ${subject.oaBrandId ?? -1}`;
}

function rowInScope(subject: RequestSubject, type: MasterTypeInfo | null, row: MasterRow): boolean {
  if (subject.adminLevel === 2 || type?.isSystem) return true;
  if (subject.adminLevel === 0) return row.USER_ID === subject.userId;
  return row.OA_BRAND_ID === (subject.oaBrandId ?? -1);
}

/* ------------------------------------------------------------------ service */

class MasterDataService {
  /** What the caller may do on the list of `typeId` (null = all masters). */
  async permissions(subject: RequestSubject, type: MasterTypeInfo | null): Promise<ResourcePermissions> {
    const typeId = type?.typeId ?? null;
    const [create, update, del] = await Promise.all([
      can(subject, typeId, 'create'),
      can(subject, typeId, 'update'),
      can(subject, typeId, 'delete'),
    ]);
    const sysAdmin = subject.adminLevel === 2;
    return {
      // CI: no Add button when a non-sysadmin views a type that does not allow user data.
      create: create && (sysAdmin || !type || type.userCanCreateData),
      update,
      // CI: $ctDetails->USER_CAN_CREATE_DATA false (or no type) → no delete / delete-all for non-sysadmin.
      delete: del && (sysAdmin || (!!type && type.userCanCreateData)),
    };
  }

  async meta(subject: RequestSubject, typeId: number | null): Promise<MasterDataMeta> {
    const type = typeId ? await this.requireType(typeId) : null;
    await this.authorize(subject, typeId, 'list');
    const [permissions, prefix, brand] = await Promise.all([
      this.permissions(subject, type),
      type && !type.isSystem ? orgCode(subject.oaId) : Promise.resolve(''),
      subject.oaBrandId
        ? prisma.oa_brands.findFirst({ where: { OA_BRAND_ID: subject.oaBrandId }, select: { country: true } })
        : Promise.resolve(null),
    ]);
    return {
      typeId,
      title: type?.typeName ?? 'Masters',
      type,
      isSysAdmin: subject.adminLevel === 2,
      codePrefix: prefix,
      defaultCountryId: brand?.country ?? null,
      canSync: !!type && !type.isSystem && subject.adminLevel !== 2 && (await can(subject, typeId, 'create')),
      permissions,
    };
  }

  async list(subject: RequestSubject, rawQuery: Record<string, string>): Promise<ListResult<MasterDataDto> & { permissions: ResourcePermissions }> {
    const query = parseListQuery(rawQuery);
    const typeId = query.filters.typeId ? this.parseId(query.filters.typeId, 'typeId') : null;
    const type = typeId ? await this.requireType(typeId) : null;
    await this.authorize(subject, typeId, 'list');

    const search = query.search
      ? Prisma.sql` AND (im."MSTR_CD" ILIKE ${`%${query.search}%`} OR im."MSTR_NM" ILIKE ${`%${query.search}%`} OR im."MSTR_DESC" ILIKE ${`%${query.search}%`})`
      : Prisma.empty;
    const where = Prisma.sql`(im."IS_DELETED" = false OR im."IS_DELETED" IS NULL)
      ${typeId ? Prisma.sql` AND im."TYP_ID" = ${typeId}` : Prisma.empty}
      ${scopeSql(subject, type)}
      ${search}`;

    const sortColumn = (query.sort && SORT_COLUMNS[query.sort]) || 'MSTR_NM';
    const dir = query.sort && SORT_COLUMNS[query.sort] ? (query.dir === 'desc' ? 'DESC' : 'ASC') : 'ASC';
    const orderBy = Prisma.raw(`m."${sortColumn}" ${dir} NULLS LAST, m."MSTR_ID" DESC`);

    const [rows, countRows, permissions] = await Promise.all([
      prisma.$queryRaw<MasterRow[]>`
        SELECT * FROM (
          SELECT DISTINCT ON (im."MSTR_ID")
                 im."MSTR_ID", im."MSTR_CD", im."MSTR_NM", im."MSTR_DESC", im."TYP_ID", im."PARENT_MSTR_ID",
                 im."IS_EDITABLE", im."IS_PREDEFINED", im."COUNTRY_ID", im."OA_ID", im."OA_BRAND_ID", im."USER_ID",
                 im."SEQUENCE"
          FROM independent_mst im
          WHERE ${where}
          ORDER BY im."MSTR_ID"
        ) m
        ORDER BY ${orderBy}
        LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`,
      prisma.$queryRaw<Array<{ total: bigint }>>`
        SELECT COUNT(DISTINCT im."MSTR_ID") AS total FROM independent_mst im WHERE ${where}`,
      this.permissions(subject, type),
    ]);

    const dtos = await this.toDtos(subject, rows, permissions);
    return { rows: dtos, total: Number(countRows[0]?.total ?? 0), page: query.page, limit: query.limit, permissions };
  }

  async get(subject: RequestSubject, rawId: string): Promise<MasterDataDto> {
    const { row, type } = await this.findScoped(subject, this.parseId(rawId, 'id'));
    await this.authorize(subject, type?.typeId ?? null, 'read');
    const [dto] = await this.toDtos(subject, [row], await this.permissions(subject, type), true);
    return dto;
  }

  async create(subject: RequestSubject, body: unknown): Promise<MasterDataDto & { message: string }> {
    const input = masterDataSchema.parse(body);
    const type = await this.requireType(input.typeId, 'typeId');
    await this.authorize(subject, type.typeId, 'create', 'EMTSI00001');
    if (subject.adminLevel !== 2 && !type.userCanCreateData) {
      throw new ForbiddenError(await ciMessage('EMTSI00001', `You are not allowed to add ${type.typeName}.`));
    }

    const tenant = await this.targetTenant(subject, type, input.oaBrandId ?? null, null);
    const prefix = type.isSystem ? '' : await orgCode(tenant.oaId);
    const code = this.buildCode(prefix, input.code);
    await this.assertCodeUnique(code);
    await this.assertNameUnique(input.name, type.typeId, tenant.oaBrandId);
    await this.assertCountry(input.countryId);
    const links = await this.resolveLinks(subject, type, input);

    await assertInsertSafe('independent_mst', 'MSTR_ID');
    if (links.parent?.hasHierarchy) await assertInsertSafe('relationship_dtl', 'REL_DET_ID');
    if (links.globalSettingId || links.menu) await assertInsertSafe('config_mapping_dtl', 'CNFG_MPPNG_DTL_ID');

    const now = new Date();
    const id = await prisma.$transaction(async (tx) => {
      const created = await tx.independent_mst.create({
        data: {
          MSTR_CD: code,
          MSTR_NM: input.name,
          MSTR_DESC: input.description,
          TYP_ID: type.typeId,
          PARENT_MSTR_ID: links.parent?.parentId ?? null,
          IS_EDITABLE: type.isEditable,
          COUNTRY_ID: input.countryId,
          OA_ID: tenant.oaId,
          OA_BRAND_ID: tenant.oaBrandId,
          USER_ID: tenant.userId,
          IS_DELETED: false,
          CREATED_BY: subject.userId,
          CREATED_ON: now,
        },
        select: { MSTR_ID: true },
      });
      const newId = created.MSTR_ID;
      // CI insertRelData only when the type has a hier_level_config row.
      if (links.parent?.hasHierarchy) {
        await tx.relationship_dtl.create({ data: this.relationshipData(subject, newId, links.parent, now) });
      }
      if (links.globalSettingId) {
        await tx.config_mapping_dtl.create({
          data: { SRC_ENTTY_ID: newId, TRGT_ENTTY_ID: links.globalSettingId, CNFG_MPPNG_TYP_ID: GLOBAL_SETTINGS_TYPE_ID, IS_DELETED: 0, UPDATED_ON: now },
        });
      }
      if (links.menu) {
        await tx.config_mapping_dtl.create({
          data: { SRC_ENTTY_ID: newId, TRGT_ENTTY_ID: links.menu.menuId, CNFG_MPPNG_TYP_ID: links.menu.mappingTypeId, IS_DELETED: 0, UPDATED_ON: now },
        });
      }
      return newId;
    });

    const dto = await this.get(subject, String(id));
    return { ...dto, message: `Successfully Created ${type.typeName}` };
  }

  async update(subject: RequestSubject, rawId: string, body: unknown): Promise<MasterDataDto & { message: string }> {
    const id = this.parseId(rawId, 'id');
    const { row } = await this.findScoped(subject, id);
    const input = masterDataSchema.parse(body);
    const type = await this.requireType(input.typeId, 'typeId');
    await this.authorize(subject, type.typeId, 'update', 'EMTSI00002');
    // CI initForm removed the Save buttons for non-sysadmins on types without USER_CAN_CREATE_DATA,
    // and update() refused masters whose IS_EDITABLE != 1.
    if (subject.adminLevel !== 2 && !type.userCanCreateData) {
      throw new ForbiddenError(await ciMessage('EMTSI00002', `You are not allowed to modify ${type.typeName}.`));
    }
    if (subject.adminLevel !== 2 && row.IS_EDITABLE !== true) {
      throw new BusinessRuleError(await ciMessage('EMTSI00002', 'This record cannot be modified.'), 'NOT_EDITABLE');
    }

    const tenant = await this.targetTenant(subject, type, input.oaBrandId ?? null, row);
    const prefix = type.isSystem ? '' : await orgCode(tenant.oaId);
    const code = this.buildCode(prefix, input.code);
    await this.assertCodeUnique(code, id);
    await this.assertCountry(input.countryId);
    const links = await this.resolveLinks(subject, type, input);

    // Parent: only the sysadmin sees the control; everyone else keeps the current parent
    // (CI posted an empty parent_id and wiped it).
    const parentProvided = subject.adminLevel === 2 && input.parentId !== undefined;
    const parentId = parentProvided ? (links.parent?.parentId ?? null) : row.PARENT_MSTR_ID;

    if (links.parent?.hasHierarchy) await assertInsertSafe('relationship_dtl', 'REL_DET_ID');
    if (links.globalSettingId || links.menu) await assertInsertSafe('config_mapping_dtl', 'CNFG_MPPNG_DTL_ID');

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.independent_mst.updateMany({
        where: { MSTR_ID: id },
        data: {
          MSTR_CD: code,
          MSTR_NM: input.name,
          MSTR_DESC: input.description,
          TYP_ID: type.typeId,
          PARENT_MSTR_ID: parentId,
          IS_EDITABLE: type.isEditable,
          COUNTRY_ID: input.countryId,
          OA_ID: tenant.oaId,
          OA_BRAND_ID: tenant.oaBrandId,
          USER_ID: tenant.userId,
          UPDATED_BY: subject.userId,
          UPDATED_ON: now,
        },
      });

      if (links.parent?.hasHierarchy) {
        // CI checkParentId(parent, child) → updateRelData (by CHILD_ID) else insertRelData.
        const existing = await tx.relationship_dtl.findFirst({
          where: { CHILD_ID: id, PARENT_ID: links.parent.parentId },
          select: { REL_DET_ID: true },
        });
        if (existing) {
          await tx.relationship_dtl.updateMany({
            where: { CHILD_ID: id },
            data: {
              HIER_LEVEL_CONFIG_ID: links.parent.hierLevelConfigId,
              PARENT_ID: links.parent.parentId,
              HIER_TYPE_ID: links.parent.hierTypeId,
              HIER_CHILD_ENTITY_TYPE_ID: links.parent.childTypeId,
              HIER_PARENT_ENTITY_TYPE_ID: links.parent.parentTypeId,
              LEVEL_SEQ: links.parent.levelSeq,
              OA_ID: subject.adminLevel === 2 ? null : subject.oaId,
              UPDATED_BY: subject.userId,
              UPDATED_ON: now,
            },
          });
        } else {
          await tx.relationship_dtl.create({ data: this.relationshipData(subject, id, links.parent, now) });
        }
      }

      // CI updateConfigRelation (by SRC + mapping type) else insertConfigRelation. CI decided by
      // (SRC, TRGT) and so inserted a second link when the target changed; one link per type here.
      const upsertLink = async (targetId: number, mappingTypeId: number) => {
        const current = await tx.config_mapping_dtl.findFirst({
          where: { SRC_ENTTY_ID: id, CNFG_MPPNG_TYP_ID: mappingTypeId, IS_DELETED: 0 },
          select: { CNFG_MPPNG_DTL_ID: true },
        });
        if (current) {
          await tx.config_mapping_dtl.updateMany({
            where: { SRC_ENTTY_ID: id, CNFG_MPPNG_TYP_ID: mappingTypeId, IS_DELETED: 0 },
            data: { TRGT_ENTTY_ID: targetId, UPDATED_BY: subject.userId, UPDATED_ON: now },
          });
        } else {
          await tx.config_mapping_dtl.create({
            data: { SRC_ENTTY_ID: id, TRGT_ENTTY_ID: targetId, CNFG_MPPNG_TYP_ID: mappingTypeId, IS_DELETED: 0, UPDATED_ON: now },
          });
        }
      };
      if (links.globalSettingId) await upsertLink(links.globalSettingId, GLOBAL_SETTINGS_TYPE_ID);
      if (links.menu) await upsertLink(links.menu.menuId, links.menu.mappingTypeId);
    });

    const dto = await this.get(subject, String(id));
    return { ...dto, message: `Successfully Updated ${type.typeName} Details` };
  }

  async remove(subject: RequestSubject, rawId: string): Promise<{ id: number; message: string }> {
    const id = this.parseId(rawId, 'id');
    const { type } = await this.findScoped(subject, id);
    await this.authorize(subject, type?.typeId ?? null, 'delete', 'EMTSI00003');
    if (subject.adminLevel !== 2 && !type?.userCanCreateData) {
      throw new ForbiddenError(await ciMessage('EMTSI00003', 'You are not allowed to delete this record.'));
    }
    // CI's "Cannot delete default …" guard tested IS_PREDEFINED == 2, which the boolean column can never hold.
    await prisma.independent_mst.updateMany({
      where: { MSTR_ID: id },
      data: { IS_DELETED: true, UPDATED_BY: subject.userId, UPDATED_ON: new Date() },
    });
    return { id, message: `${type?.typeName ?? 'Master'} deleted successfully` };
  }

  /**
   * CI replicateMstrForBrandByTypeID: copies the global masters (OA_ID 0 / NULL) of a type into the
   * active brand, code prefixed with the brand code. CI's "delete existing brand rows first" step is
   * commented out, so every click duplicated the brand's masters; here a master whose prefixed code
   * already exists for the brand is skipped, deleted global masters are not copied, and the
   * migrated duplicate source rows are copied once.
   */
  async syncForBrand(subject: RequestSubject, typeId: number): Promise<{ typeId: number; inserted: number; message: string }> {
    const type = await this.requireType(typeId, 'typeId');
    await this.authorize(subject, typeId, 'create');
    if (type.isSystem) throw new BusinessRuleError(`${type.typeName} is system data and is not synced per brand.`, 'SYSTEM_TYPE');
    if (!subject.oaBrandId) throw new ValidationError('Please Select A Brand', { oaBrandId: ['Please Select A Brand'] });

    const brand = await prisma.oa_brands.findFirst({
      where: { OA_BRAND_ID: subject.oaBrandId },
      select: { OA_BRAND_ID: true, OA_ID: true, OA_BRAND_CD: true },
    });
    if (!brand) throw new NotFoundError('Brand not found.');
    const brandCode = (brand.OA_BRAND_CD ?? '').trim();

    await assertInsertSafe('independent_mst', 'MSTR_ID');
    const inserted = await prisma.$executeRaw`
      INSERT INTO independent_mst
        ("MSTR_CD", "MSTR_NM", "MSTR_DESC", "TYP_ID", "PARENT_MSTR_ID", "IS_EDITABLE", "IS_PREDEFINED",
         "OA_ID", "OA_BRAND_ID", "CREATED_BY", "CREATED_ON")
      SELECT CONCAT(${brandCode}::text, src."MSTR_CD"), src."MSTR_NM", src."MSTR_DESC", src."TYP_ID", src."PARENT_MSTR_ID",
             src."IS_EDITABLE", src."IS_PREDEFINED", ${brand.OA_ID}, ${brand.OA_BRAND_ID}, ${subject.userId}, NOW()
      FROM (
        SELECT DISTINCT ON (g."MSTR_ID") g.*
        FROM independent_mst g
        WHERE (g."OA_ID" = 0 OR g."OA_ID" IS NULL)
          AND g."TYP_ID" = ${typeId}
          AND (g."IS_DELETED" = false OR g."IS_DELETED" IS NULL)
        ORDER BY g."MSTR_ID"
      ) src
      WHERE NOT EXISTS (
        SELECT 1 FROM independent_mst b
        WHERE b."TYP_ID" = ${typeId}
          AND b."OA_BRAND_ID" = ${brand.OA_BRAND_ID}
          AND (b."IS_DELETED" = false OR b."IS_DELETED" IS NULL)
          AND UPPER(COALESCE(b."MSTR_CD", '')) = UPPER(CONCAT(${brandCode}::text, src."MSTR_CD"))
      )`;
    return { typeId, inserted, message: 'Synced Successfully' };
  }

  /** Dropdown data for the list filter and the form (CI initForm / getDependent*Dropdown). */
  async options(subject: RequestSubject, kind: MasterOptionsKind, typeId: number | null): Promise<MasterOption[]> {
    switch (kind) {
      case 'types':
        return this.typeOptions(subject);
      case 'parents':
        return typeId ? this.parentOptions(typeId) : [];
      case 'countries':
        return this.countryOptions(subject);
      case 'global-settings':
        return getMasterOptionsByType(GLOBAL_SETTINGS_TYPE_ID);
      case 'menus': {
        const menuType = typeId ? menuTypeFor(typeId) : null;
        return menuType ? getMasterOptionsByType(menuType) : [];
      }
    }
  }

  /** CI common_type_m::getAllCommonTypeDetails: sysadmin all, others only VISIBLE_TO_USER_FLAG = 1. */
  async typeOptions(subject: RequestSubject): Promise<MasterOption[]> {
    const rows = await prisma.common_type.findMany({
      where: { ...NOT_DELETED, ...(subject.adminLevel === 2 ? {} : { VISIBLE_TO_USER_FLAG: 1 }) },
      select: { TYP_ID: true, TYP_NM: true, TYP_CD: true },
      orderBy: [{ TYP_NM: 'asc' }, { TYP_ID: 'asc' }],
    });
    return dedupeOptions(rows.map((r) => ({ value: r.TYP_ID, label: r.TYP_NM, code: r.TYP_CD })));
  }

  // ---------------------------------------------------------------- internals

  private async parentTypeFor(typeId: number): Promise<{ parentTypeId: number; hier: HierConfig | null } | null> {
    const hier = await prisma.hier_level_config.findFirst({
      where: { HIER_CHILD_ENTITY_TYPE_ID: typeId },
      select: {
        HIER_LEVEL_CONFIG_ID: true,
        HIER_TYPE_ID: true,
        HIER_CHILD_ENTITY_TYPE_ID: true,
        HIER_PARENT_ENTITY_TYPE_ID: true,
        LEVEL_SEQ: true,
      },
      orderBy: { HIER_LEVEL_CONFIG_ID: 'asc' },
    });
    if (hier?.HIER_PARENT_ENTITY_TYPE_ID) return { parentTypeId: hier.HIER_PARENT_ENTITY_TYPE_ID, hier };
    // CI initForm fallback: common_type.PARENT_TYP_ID, with the hard-coded 213 (sub category) → 212.
    const type = await prisma.common_type.findFirst({ where: { TYP_ID: typeId }, select: { PARENT_TYP_ID: true } });
    const parentTypeId = typeId === 213 ? 212 : type?.PARENT_TYP_ID;
    return parentTypeId ? { parentTypeId, hier: hier ?? null } : null;
  }

  private async parentOptions(typeId: number): Promise<MasterOption[]> {
    const parent = await this.parentTypeFor(typeId);
    return parent ? getMasterOptionsByType(parent.parentTypeId) : [];
  }

  /** CI leavetypedtl_m::getAllLocMstDD(COUNTRY): countries (location_mst type 61) of the active brand. */
  private async countryOptions(subject: RequestSubject): Promise<MasterOption[]> {
    const rows = await prisma.location_mst.findMany({
      where: { LOC_TYPE_ID: COUNTRY_LOCATION_TYPE_ID, OA_BRAND_ID: subject.oaBrandId ?? -1, ...NOT_DELETED },
      select: { LOC_ID: true, LOC_NAME: true, LOC_CODE: true },
      orderBy: [{ LOC_NAME: 'asc' }, { LOC_ID: 'asc' }],
    });
    return dedupeOptions(rows.map((r) => ({ value: r.LOC_ID, label: r.LOC_NAME ?? r.LOC_CODE ?? String(r.LOC_ID), code: r.LOC_CODE })));
  }

  private async authorize(subject: RequestSubject, typeId: number | null, action: ResourceAction, messageCode?: string) {
    if (await can(subject, typeId, action)) return;
    throw new ForbiddenError(messageCode ? await ciMessage(messageCode, 'You do not have permission to perform this action.') : undefined);
  }

  private parseId(raw: string, field: string): number {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) throw new ValidationError('Invalid id.', { [field]: ['Must be a positive integer.'] });
    return id;
  }

  private async requireType(typeId: number, field = 'typeId'): Promise<MasterTypeInfo> {
    const type = await loadMasterType(typeId);
    if (!type) throw new ValidationError('Validation failed.', { [field]: ['Select a valid type.'] });
    return type;
  }

  private async findScoped(subject: RequestSubject, id: number): Promise<{ row: MasterRow; type: MasterTypeInfo | null }> {
    const row = await prisma.independent_mst.findFirst({
      where: { MSTR_ID: id, ...NOT_DELETED },
      select: MASTER_SELECT,
      orderBy: { UPDATED_ON: { sort: 'desc', nulls: 'last' } },
    });
    if (!row) throw new NotFoundError('Master data not found.');
    const type = await loadMasterType(row.TYP_ID);
    // Out-of-scope rows behave like missing ones (no IDOR).
    if (!rowInScope(subject, type, row)) throw new NotFoundError('Master data not found.');
    return { row, type };
  }

  /** CI insert/updateIndpMstData org/brand/user selection. */
  private async targetTenant(
    subject: RequestSubject,
    type: MasterTypeInfo,
    requestedBrandId: number | null,
    existing: MasterRow | null,
  ): Promise<Tenant> {
    if (type.isSystem) return { oaId: null, oaBrandId: null, userId: null };
    if (subject.adminLevel !== 2) return { oaId: subject.oaId, oaBrandId: subject.oaBrandId, userId: subject.userId };
    if (requestedBrandId) {
      const brand = await prisma.oa_brands.findFirst({
        where: { OA_BRAND_ID: requestedBrandId, IS_DELETED: 0 },
        select: { OA_BRAND_ID: true, OA_ID: true },
      });
      if (!brand) throw new ValidationError('Validation failed.', { oaBrandId: ['Brand not found.'] });
      return { oaId: brand.OA_ID, oaBrandId: brand.OA_BRAND_ID, userId: subject.userId };
    }
    if (existing && existing.OA_BRAND_ID) {
      return { oaId: existing.OA_ID, oaBrandId: existing.OA_BRAND_ID, userId: existing.USER_ID ?? subject.userId };
    }
    return { oaId: subject.oaId, oaBrandId: subject.oaBrandId, userId: subject.userId };
  }

  private buildCode(prefix: string, rawCode: string): string {
    const code = `${prefix}${stripPrefix(rawCode.toUpperCase(), prefix)}`;
    if (code.length > 15) {
      throw new ValidationError('Validation failed.', {
        code: [`Master Code is too long (at most ${Math.max(15 - prefix.length, 1)} characters after the prefix ${prefix}).`],
      });
    }
    return code;
  }

  /** CI checkCode_IsUnique: MSTR_CD unique among non-deleted masters, the edited record excluded. */
  private async assertCodeUnique(code: string, exceptId?: number) {
    const clash = await prisma.independent_mst.findFirst({
      where: {
        MSTR_CD: { equals: code, mode: 'insensitive' },
        ...NOT_DELETED,
        ...(exceptId ? { NOT: { MSTR_ID: exceptId } } : {}),
      },
      select: { MSTR_ID: true },
    });
    if (clash) throw new ConflictError('Master Code already exists', { code: ['Master Code already exists'] });
  }

  /** CI checkMasterName (insert only): name unique per type + brand among non-deleted masters. */
  private async assertNameUnique(name: string, typeId: number, oaBrandId: number | null) {
    const clash = await prisma.independent_mst.findFirst({
      where: { MSTR_NM: { equals: name, mode: 'insensitive' }, TYP_ID: typeId, OA_BRAND_ID: oaBrandId, ...NOT_DELETED },
      select: { MSTR_ID: true },
    });
    if (clash) throw new ConflictError('Master Name already exists', { name: ['Master Name already exists'] });
  }

  private async assertCountry(countryId: number | null) {
    if (!countryId) return;
    const country = await prisma.location_mst.findFirst({
      where: { LOC_ID: countryId, LOC_TYPE_ID: COUNTRY_LOCATION_TYPE_ID },
      select: { LOC_ID: true },
    });
    if (!country) throw new ValidationError('Validation failed.', { countryId: ['Select a valid country.'] });
  }

  /** Validates the sysadmin-only parent / global-settings / menu controls; ignored for everyone else. */
  private async resolveLinks(subject: RequestSubject, type: MasterTypeInfo, input: MasterDataInput): Promise<Links> {
    if (subject.adminLevel !== 2) return { parent: null, globalSettingId: null, menu: null };
    const errors: Record<string, string[]> = {};

    let parent: ParentLink | null = null;
    if (input.parentId) {
      const parentType = await this.parentTypeFor(type.typeId);
      const parentRow = parentType
        ? await prisma.independent_mst.findFirst({
            where: { MSTR_ID: input.parentId, TYP_ID: parentType.parentTypeId, ...NOT_DELETED },
            select: { MSTR_ID: true },
          })
        : null;
      if (!parentType || !parentRow) errors.parentId = ['Select a valid parent.'];
      else parent = { parentId: input.parentId, ...(parentType.hier ? hierFields(parentType.hier) : noHier(type.typeId, parentType.parentTypeId)) };
    }

    let globalSettingId: number | null = null;
    if (input.globalSettingId) {
      const gs = await prisma.independent_mst.findFirst({
        where: { MSTR_ID: input.globalSettingId, TYP_ID: GLOBAL_SETTINGS_TYPE_ID },
        select: { MSTR_ID: true },
      });
      if (!gs) errors.globalSettingId = ['Select a valid global setting.'];
      else globalSettingId = gs.MSTR_ID;
    }

    let menu: Links['menu'] = null;
    if (input.menuId) {
      const menuType = menuTypeFor(type.typeId);
      const menuRow = menuType
        ? await prisma.independent_mst.findFirst({ where: { MSTR_ID: input.menuId, TYP_ID: menuType }, select: { MSTR_ID: true } })
        : null;
      if (!menuType || !menuRow) errors.menuId = ['Select a valid menu.'];
      else menu = { menuId: menuRow.MSTR_ID, mappingTypeId: menuType };
    }

    if (Object.keys(errors).length) throw new ValidationError('Validation failed.', errors);
    return { parent, globalSettingId, menu };
  }

  private relationshipData(subject: RequestSubject, childId: number, parent: ParentLink, now: Date) {
    return {
      HIER_LEVEL_CONFIG_ID: parent.hierLevelConfigId,
      CHILD_ID: childId,
      PARENT_ID: parent.parentId,
      HIER_TYPE_ID: parent.hierTypeId,
      HIER_CHILD_ENTITY_TYPE_ID: parent.childTypeId,
      HIER_PARENT_ENTITY_TYPE_ID: parent.parentTypeId,
      LEVEL_SEQ: parent.levelSeq,
      OA_ID: subject.adminLevel === 2 ? null : subject.oaId,
      CREATED_BY: subject.userId,
      CREATED_ON: now,
    };
  }

  private async toDtos(
    subject: RequestSubject,
    rows: MasterRow[],
    permissions: ResourcePermissions,
    withLinks = false,
  ): Promise<MasterDataDto[]> {
    if (!rows.length) return [];
    const typeIds = [...new Set(rows.map((r) => r.TYP_ID))];
    const orgIds = [...new Set(rows.map((r) => r.OA_ID).filter((v): v is number => typeof v === 'number'))];
    const countryIds = [...new Set(rows.map((r) => r.COUNTRY_ID).filter((v): v is number => typeof v === 'number' && v > 0))];

    const [typeNames, types, parents, countries, orgs, links] = await Promise.all([
      commonTypeNames(typeIds),
      Promise.all(typeIds.map((t) => loadMasterType(t))),
      masterNames(rows.map((r) => r.PARENT_MSTR_ID)),
      countryIds.length
        ? prisma.location_mst.findMany({ where: { LOC_ID: { in: countryIds } }, select: { LOC_ID: true, LOC_NAME: true } })
        : Promise.resolve([]),
      orgIds.length ? prisma.org_accounts.findMany({ where: { OA_ID: { in: orgIds } }, select: { OA_ID: true, OA_CD: true } }) : Promise.resolve([]),
      withLinks
        ? prisma.config_mapping_dtl.findMany({
            where: {
              SRC_ENTTY_ID: { in: rows.map((r) => r.MSTR_ID) },
              CNFG_MPPNG_TYP_ID: { in: [GLOBAL_SETTINGS_TYPE_ID, MENU_FOR_MODULE_TYPE_ID, MENU_FOR_EPIC_TYPE_ID] },
              IS_DELETED: 0,
            },
            select: { SRC_ENTTY_ID: true, TRGT_ENTTY_ID: true, CNFG_MPPNG_TYP_ID: true },
          })
        : Promise.resolve([]),
    ]);
    const typeById = new Map(types.filter((t): t is MasterTypeInfo => !!t).map((t) => [t.typeId, t]));
    const countryName = new Map(countries.map((c) => [c.LOC_ID, c.LOC_NAME]));
    const orgCd = new Map(orgs.map((o) => [o.OA_ID, (o.OA_CD ?? '').trim().toUpperCase()]));
    const sysAdmin = subject.adminLevel === 2;

    return rows.map((r) => {
      const type = typeById.get(r.TYP_ID) ?? null;
      const prefix = type && !type.isSystem && r.OA_ID ? (orgCd.get(r.OA_ID) ?? '') : '';
      const link = (typeId: number) => links.find((l) => l.SRC_ENTTY_ID === r.MSTR_ID && l.CNFG_MPPNG_TYP_ID === typeId)?.TRGT_ENTTY_ID ?? null;
      const menuType = menuTypeFor(r.TYP_ID);
      return {
        id: r.MSTR_ID,
        code: r.MSTR_CD,
        codeInput: stripPrefix(r.MSTR_CD, prefix),
        codePrefix: prefix,
        name: r.MSTR_NM,
        description: r.MSTR_DESC,
        typeId: r.TYP_ID,
        typeName: typeNames.get(r.TYP_ID) ?? null,
        parentId: r.PARENT_MSTR_ID && r.PARENT_MSTR_ID > 0 ? r.PARENT_MSTR_ID : null,
        parentName: r.PARENT_MSTR_ID ? (parents.get(r.PARENT_MSTR_ID)?.name ?? null) : null,
        countryId: r.COUNTRY_ID && r.COUNTRY_ID > 0 ? r.COUNTRY_ID : null,
        countryName: r.COUNTRY_ID ? (countryName.get(r.COUNTRY_ID) ?? null) : null,
        isEditable: r.IS_EDITABLE === true,
        isPredefined: r.IS_PREDEFINED === true,
        oaBrandId: r.OA_BRAND_ID,
        globalSettingId: link(GLOBAL_SETTINGS_TYPE_ID),
        menuId: menuType ? link(menuType) : null,
        canEdit: permissions.update && (sysAdmin || (r.IS_EDITABLE === true && !!type?.userCanCreateData)),
        canDelete: permissions.delete && (sysAdmin || !!type?.userCanCreateData),
      };
    });
  }
}

/* ------------------------------------------------------------------ link types */

interface HierConfig {
  HIER_LEVEL_CONFIG_ID: number;
  HIER_TYPE_ID: number;
  HIER_CHILD_ENTITY_TYPE_ID: number;
  HIER_PARENT_ENTITY_TYPE_ID: number | null;
  LEVEL_SEQ: number;
}

interface ParentLink {
  parentId: number;
  hierLevelConfigId: number;
  hierTypeId: number;
  childTypeId: number;
  parentTypeId: number | null;
  levelSeq: number;
  /** false → the type has no hier_level_config row: CI then only stored PARENT_MSTR_ID. */
  hasHierarchy: boolean;
}

interface Links {
  parent: ParentLink | null;
  globalSettingId: number | null;
  menu: { menuId: number; mappingTypeId: number } | null;
}

function hierFields(h: HierConfig): Omit<ParentLink, 'parentId'> {
  return {
    hierLevelConfigId: h.HIER_LEVEL_CONFIG_ID,
    hierTypeId: h.HIER_TYPE_ID,
    childTypeId: h.HIER_CHILD_ENTITY_TYPE_ID,
    parentTypeId: h.HIER_PARENT_ENTITY_TYPE_ID,
    levelSeq: h.LEVEL_SEQ,
    hasHierarchy: true,
  };
}

function noHier(childTypeId: number, parentTypeId: number): Omit<ParentLink, 'parentId'> {
  return { hierLevelConfigId: 0, hierTypeId: 0, childTypeId, parentTypeId, levelSeq: 0, hasHierarchy: false };
}

/** CI checkModuleEpic: Module Function → Module Menu Item, Functional Epic → Functional Menu Item. */
export function menuTypeFor(typeId: number): number | null {
  if (typeId === MODULE_TYPE_ID) return MENU_FOR_MODULE_TYPE_ID;
  if (typeId === EPIC_TYPE_ID) return MENU_FOR_EPIC_TYPE_ID;
  return null;
}

export const masterDataService = new MasterDataService();
