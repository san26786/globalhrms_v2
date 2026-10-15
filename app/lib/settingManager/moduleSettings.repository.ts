import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { BusinessRuleError } from '@/lib/http/errors';
import { getMasterId } from '@/lib/masters/masterService';
import { settingService, toNumber } from '@/lib/settings/settingService';
import { MODULE_MENU_ITEM_TYPE_ID } from './moduleSettings.registry';
import type {
  AnswerWrite,
  AttributeRecord,
  GroupSource,
  IdName,
  ModuleSettingsReader,
  ModuleSettingsWriter,
  ReadScope,
  ScreenQuery,
} from './moduleSettings.types';

/**
 * Prisma implementation of the settings reader + writer — the queries of CI setting_group_mst_m,
 * setting_group_section_header_mst_m, setting_group_attribute_mst_m, setting_group_attribute_value_mst_m
 * and oa_brand_setting_attribute_mst_m (the settings system CI uses here; NOT oa_brand_settings_m).
 *
 * - The CI views setting_group_attribute_mst_vw / setting_group_attribute_Value_mst_vw do not exist in
 *   PostgreSQL: the base tables carry every column used, and the option label (the view's
 *   SYSTEM_SETTING_ATTRIBUTE_VALUE) is independent_mst.MSTR_NM of SYSTEM_SETTING_ATTRIBUTE_VALUE_ID.
 * - independent_mst holds duplicated rows, so it is only ever used through EXISTS / a single-row lookup.
 * - Every query is parameterised. CI getSettingGroupsByModuleId pasted the URL ids into its SQL
 *   (SQL injection) — behaviour change.
 * Every write method is one transaction.
 */

const NOT_DELETED_BOOL = { OR: [{ IS_DELETED: false }, { IS_DELETED: null }] };

function uniqueById<T extends { value: number }>(list: T[]): T[] {
  const seen = new Set<number>();
  return list.filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)));
}

/** "Is this master visible for the application?" — CI JOIN independent_mst im … AND (im.APP_ID IS NULL OR im.APP_ID = ?). */
const appMatch = (masterColumn: Prisma.Sql, appId: number) => Prisma.sql`
  EXISTS (SELECT 1 FROM independent_mst im WHERE im."MSTR_ID" = ${masterColumn} AND (im."APP_ID" IS NULL OR im."APP_ID" = ${appId}))`;

async function appIdOf(oaBrandId: number): Promise<number> {
  // CI getSettingAttributeValue('SSABAN', brand) returns 0 when unset.
  return toNumber(await settingService.getValue('SSABAN', oaBrandId));
}

export class PrismaModuleSettingsRepository implements ModuleSettingsReader, ModuleSettingsWriter {
  // ------------------------------------------------------------------ reader

  masterId(code: string): Promise<number | null> {
    return getMasterId(code);
  }

  async masterName(id: number): Promise<string | null> {
    const row = await prisma.independent_mst.findFirst({ where: { MSTR_ID: id }, select: { MSTR_NM: true }, orderBy: { MSTR_ID: 'asc' } });
    return row?.MSTR_NM ?? null;
  }

  settingValue(code: string, oaBrandId: number): Promise<string | null> {
    return settingService.getValue(code, oaBrandId);
  }

  async groups(source: GroupSource, query: ScreenQuery, scope: ReadScope): Promise<IdName[]> {
    const appId = source.appBrand === 'zero' ? await appIdOf(0) : scope.sessionAppId;
    const conditions: Prisma.Sql[] = [Prisma.sql`sg."IS_DELETED" = 0`, Prisma.sql`sg."ENABLED" = 1`];

    if (source.kind === 'settingType') {
      // CI getSettingGroupsByCompanySetting / getSettingGroupsBySystemSetting
      const typeId = await getMasterId(source.typeCode);
      if (typeId === null) return [];
      conditions.push(Prisma.sql`sg."SETTING_TYPE_ID" = ${typeId}`);
    } else {
      // CI getSettingGroupsByModuleId: nothing selected → no groups.
      const link: Prisma.Sql[] = [];
      if (query.settingGroupId) conditions.push(Prisma.sql`sg."SETTING_GROUP_ID" = ${query.settingGroupId}`);
      if (query.moduleId) link.push(Prisma.sql`sgsl."MODULE_ID" = ${query.moduleId}`);
      if (query.funcAreaId) link.push(Prisma.sql`sgsl."FUNC_AREA_ID" = ${query.funcAreaId}`);
      if (!query.settingGroupId && !link.length) return [];
      conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM setting_group_system_link sgsl
        WHERE sgsl."SETTING_GROUP_ID" = sg."SETTING_GROUP_ID"${link.length ? Prisma.sql` AND ${Prisma.join(link, ' AND ')}` : Prisma.empty})`);
    }
    if (!scope.isSysAdmin) conditions.push(appMatch(Prisma.sql`sg."SETTING_GROUP_NAME_ID"`, appId));

    const rows = await prisma.$queryRaw<Array<{ id: number; name: string | null }>>`
      SELECT DISTINCT sg."SETTING_GROUP_ID" AS id, sg."SETTING_GROUP_NAME" AS name
      FROM setting_group_mst sg
      WHERE ${Prisma.join(conditions, ' AND ')}
      ORDER BY sg."SETTING_GROUP_ID"`;
    return rows.map((r) => ({ value: r.id, label: (r.name ?? '').trim() }));
  }

  async headers(groupIds: number[]): Promise<Map<number, IdName[]>> {
    const map = new Map<number, IdName[]>();
    if (!groupIds.length) return map;
    // CI getHeadersByGroupId (no ORDER BY: database order ≈ id order).
    const rows = await prisma.setting_group_section_header_mst.findMany({
      where: { SETTING_GROUP_ID: { in: groupIds }, IS_DELETED: 0 },
      select: { SETTING_GROUP_SECTION_HEADER_ID: true, SETTING_GROUP_SECTION_TITLE: true, SETTING_GROUP_ID: true },
      orderBy: { SETTING_GROUP_SECTION_HEADER_ID: 'asc' },
    });
    for (const r of rows) {
      if (r.SETTING_GROUP_ID == null) continue;
      const list = map.get(r.SETTING_GROUP_ID) ?? [];
      if (!list.some((h) => h.value === r.SETTING_GROUP_SECTION_HEADER_ID)) {
        list.push({ value: r.SETTING_GROUP_SECTION_HEADER_ID, label: r.SETTING_GROUP_SECTION_TITLE.trim() });
      }
      map.set(r.SETTING_GROUP_ID, list);
    }
    return map;
  }

  async attributes(headerIds: number[], scope: ReadScope): Promise<AttributeRecord[]> {
    if (!headerIds.length) return [];
    // CI getAttributeByHeaderId: below super admin only BRAND_ENABLE = 1 attributes of the session
    // brand's application; ordered by the attribute master's SEQUENCE.
    const brandFilter = scope.isSysAdmin
      ? Prisma.empty
      : Prisma.sql` AND a."BRAND_ENABLE" = 1 AND ${appMatch(Prisma.sql`a."SYSTEM_SETTING_ATTRIBUTE_ID"`, scope.sessionAppId)}`;
    const rows = await prisma.$queryRaw<Array<Record<string, number | string | null>>>`
      SELECT a."SETTING_ATTRIBUTE_ID", a."SETTING_GROUP_SECTION_HEADER_ID", a."SYSTEM_SETTING_ATTRIBUTE_CD",
             a."SETTING_ATTRIBUTE_DESC", a."SETTING_INPUT_VALUE_TYPE_ID", a."INPUT_OPTION_TYPE_ID",
             a."GLOBAL_SETTING_DATA_TYPE_ID", a."ANSWER_GROUP_ID", a."SYSTEM_TYPE_ID", a."DEPENDENT_ON_ATTRIBUTE_ID",
             (SELECT im."SEQUENCE" FROM independent_mst im WHERE im."MSTR_ID" = a."SYSTEM_SETTING_ATTRIBUTE_ID" ORDER BY im."MSTR_ID" LIMIT 1) AS seq
      FROM setting_group_attribute_mst a
      WHERE a."SETTING_GROUP_SECTION_HEADER_ID" = ANY(${headerIds}::int[])
        AND a."IS_DELETED" = 0${brandFilter}
      ORDER BY seq ASC NULLS LAST, a."SETTING_ATTRIBUTE_ID"`;
    return rows.map(toAttribute);
  }

  async options(attributes: AttributeRecord[], systemInputTypeId: number | null): Promise<Map<number, IdName[]>> {
    const map = new Map<number, IdName[]>();
    const system = attributes.filter((a) => systemInputTypeId !== null && a.inputValueTypeId === systemInputTypeId && a.systemTypeId);
    const answered = attributes.filter((a) => !system.includes(a) && a.answerGroupId);

    // CI indp_mst_data_m::getAllIndMstDetailsByTypeId(SYSTEM_TYPE_ID): MSTR_ID / MSTR_NM.
    const typeIds = [...new Set(system.map((a) => a.systemTypeId as number))];
    if (typeIds.length) {
      const masters = await prisma.independent_mst.findMany({
        where: { TYP_ID: { in: typeIds }, ...NOT_DELETED_BOOL },
        select: { MSTR_ID: true, MSTR_NM: true, TYP_ID: true },
        orderBy: { MSTR_ID: 'asc' },
      });
      for (const a of system) {
        map.set(a.attributeId, uniqueById(masters.filter((m) => m.TYP_ID === a.systemTypeId).map((m) => ({ value: m.MSTR_ID, label: (m.MSTR_NM ?? '').trim() }))));
      }
    }

    // CI setting_group_attribute_value_mst_m::getValuesByAnswerGroupId(ANSWER_GROUP_ID).
    const groupIds = [...new Set(answered.map((a) => a.answerGroupId as number))];
    if (groupIds.length) {
      const values = await prisma.$queryRaw<Array<{ id: number; group: number; label: string | null }>>`
        SELECT v."SETTING_ATTRIBUTE_OPTIONS_ID" AS id, v."ANSWER_GROUP_ID" AS "group",
               COALESCE((SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = v."SYSTEM_SETTING_ATTRIBUTE_VALUE_ID" ORDER BY im."MSTR_ID" LIMIT 1),
                        v."INPUT_OPTION_DESC") AS label
        FROM "setting_group_attribute_Value_mst" v
        WHERE v."ANSWER_GROUP_ID" = ANY(${groupIds}::int[]) AND v."IS_DELETED" = 0
        ORDER BY v."SETTING_ATTRIBUTE_OPTIONS_ID" ASC`;
      for (const a of answered) {
        map.set(a.attributeId, uniqueById(values.filter((v) => v.group === a.answerGroupId).map((v) => ({ value: v.id, label: (v.label ?? '').trim() }))));
      }
    }
    return map;
  }

  async answers(attributeIds: number[], oaBrandId: number | null): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    if (!attributeIds.length) return map;
    // CI getSetAttrOptionIdByAttrId: the brand's row (not for the super admin), else brand 0; the
    // FIRST row of each (duplicates exist). NOTE: lib/settings/settingService (login policies)
    // takes the LAST row instead — the two disagree only where duplicates exist (flagged).
    const brands = oaBrandId ? [oaBrandId, 0] : [0];
    const rows = await prisma.oa_brand_setting_attribute_mst.findMany({
      where: { SETTING_ATTRIBUTE_ID: { in: attributeIds }, OA_BRAND_ID: { in: brands } },
      select: { SETTING_ATTRIBUTE_ID: true, OA_BRAND_ID: true, SETTING_ATTRIBUTE_OPTIONS_ID: true },
      orderBy: { OA_BRAND_SETTING_ATTRIBUTE_ID: 'asc' },
    });
    for (const brand of [...brands].reverse()) {
      // brand 0 first, then the brand's own row overrides it
      const seen = new Set<number>();
      for (const r of rows) {
        if (r.OA_BRAND_ID !== brand || r.SETTING_ATTRIBUTE_ID == null || seen.has(r.SETTING_ATTRIBUTE_ID)) continue;
        seen.add(r.SETTING_ATTRIBUTE_ID);
        map.set(r.SETTING_ATTRIBUTE_ID, r.SETTING_ATTRIBUTE_OPTIONS_ID ?? '');
      }
    }
    return map;
  }

  async attributesById(attributeIds: number[]): Promise<AttributeRecord[]> {
    if (!attributeIds.length) return [];
    const rows = await prisma.$queryRaw<Array<Record<string, number | string | null>>>`
      SELECT a."SETTING_ATTRIBUTE_ID", a."SETTING_GROUP_SECTION_HEADER_ID", a."SYSTEM_SETTING_ATTRIBUTE_CD",
             a."SETTING_ATTRIBUTE_DESC", a."SETTING_INPUT_VALUE_TYPE_ID", a."INPUT_OPTION_TYPE_ID",
             a."GLOBAL_SETTING_DATA_TYPE_ID", a."ANSWER_GROUP_ID", a."SYSTEM_TYPE_ID", a."DEPENDENT_ON_ATTRIBUTE_ID"
      FROM setting_group_attribute_mst a
      WHERE a."SETTING_ATTRIBUTE_ID" = ANY(${attributeIds}::int[]) AND a."IS_DELETED" = 0`;
    const seen = new Set<number>();
    return rows.map(toAttribute).filter((a) => (seen.has(a.attributeId) ? false : (seen.add(a.attributeId), true)));
  }

  async enabledModules(scope: ReadScope): Promise<IdName[]> {
    // CI oa_brand_setting_attribute_mst_m::getEnabledModules (session brand).
    const brandFilter = scope.isSysAdmin
      ? Prisma.empty
      : Prisma.sql` AND EXISTS (SELECT 1 FROM "OA_Module_Config" omc
          WHERE omc."MSTR_ID" = cm."SRC_ENTTY_ID" AND omc."IS_ENABLED" = true AND omc."IS_LICENSED" = true
            AND omc."OA_BRAND_ID" = ${scope.sessionBrandId ?? -1})
          AND (im."APP_ID" IS NULL OR im."APP_ID" = ${scope.sessionAppId})`;
    const rows = await prisma.$queryRaw<Array<{ id: number; name: string | null }>>`
      SELECT DISTINCT im."MSTR_ID" AS id, im."MSTR_NM" AS name
      FROM setting_group_system_link sgsl
      JOIN independent_mst im ON im."MSTR_ID" = sgsl."MODULE_ID"
      JOIN config_mapping_dtl cm ON cm."TRGT_ENTTY_ID" = im."MSTR_ID"
      WHERE im."TYP_ID" = ${MODULE_MENU_ITEM_TYPE_ID}${brandFilter}
      ORDER BY name`;
    return uniqueById(rows.map((r) => ({ value: r.id, label: (r.name ?? '').trim() })));
  }

  async funcAreas(moduleId: number): Promise<IdName[]> {
    // CI getSelectedFuncAreaByModuleId: children of the module's menu node that have setting groups.
    const source = await prisma.config_mapping_dtl.findFirst({
      where: { TRGT_ENTTY_ID: moduleId },
      select: { SRC_ENTTY_ID: true },
      orderBy: { SRC_ENTTY_ID: 'asc' },
    });
    if (!source?.SRC_ENTTY_ID) return [];
    const rows = await prisma.$queryRaw<Array<{ id: number; name: string | null }>>`
      SELECT id, name FROM (
        SELECT DISTINCT ON (im."MSTR_NM") im."MSTR_ID" AS id, im."MSTR_NM" AS name, md."sequence" AS seq
        FROM relationship_dtl_vw rd
        LEFT JOIN config_mapping_dtl cm ON cm."SRC_ENTTY_ID" = rd."CHILD_MSTR_ID"
        LEFT JOIN independent_mst im ON im."MSTR_ID" = cm."TRGT_ENTTY_ID"
        JOIN menu_config md ON md."MENU_ID" = rd."REL_DET_ID"
        WHERE rd."PARENT_HIER_ID" = ${source.SRC_ENTTY_ID}
          AND EXISTS (SELECT 1 FROM setting_group_system_link sgsl WHERE sgsl."FUNC_AREA_ID" = im."MSTR_ID")
        ORDER BY im."MSTR_NM", md."sequence"
      ) f
      ORDER BY seq NULLS LAST, name`;
    return uniqueById(rows.map((r) => ({ value: r.id, label: (r.name ?? '').trim() })));
  }

  async groupsForModule(moduleId: number | null, appId: number): Promise<IdName[]> {
    // CI getAllSettingGroups(0, $moduleId): with a module only its linked groups (INNER JOIN).
    const moduleFilter = moduleId
      ? Prisma.sql` AND EXISTS (SELECT 1 FROM setting_group_system_link sgsl WHERE sgsl."SETTING_GROUP_ID" = sg."SETTING_GROUP_ID" AND sgsl."MODULE_ID" = ${moduleId})`
      : Prisma.empty;
    const rows = await prisma.$queryRaw<Array<{ id: number; name: string | null }>>`
      SELECT DISTINCT sg."SETTING_GROUP_ID" AS id, sg."SETTING_GROUP_NAME" AS name
      FROM setting_group_mst sg
      WHERE sg."IS_DELETED" = 0 AND sg."ENABLED" = 1${moduleFilter}
        AND ${appMatch(Prisma.sql`sg."SETTING_GROUP_NAME_ID"`, appId)}
      ORDER BY sg."SETTING_GROUP_ID"`;
    return rows.map((r) => ({ value: r.id, label: (r.name ?? '').trim() }));
  }

  // ------------------------------------------------------------------ writer

  async saveAnswers(command: {
    oaId: number | null;
    oaBrandId: number;
    userId: number;
    answers: AnswerWrite[];
    codeWrites: Array<{ code: string; value: string }>;
  }): Promise<{ updated: number; inserted: number }> {
    // CI updateValueByAttributeCode: code → masters → every attribute of those masters.
    const byAttribute = new Map<number, string>(command.answers.map((a) => [a.attributeId, a.value]));
    for (const write of command.codeWrites) {
      for (const attributeId of await this.attributeIdsForCode(write.code)) byAttribute.set(attributeId, write.value);
    }
    if (byAttribute.size === 0) return { updated: 0, inserted: 0 };
    const attributeIds = [...byAttribute.keys()];

    const [existing, meta] = await Promise.all([
      prisma.oa_brand_setting_attribute_mst.findMany({
        where: { SETTING_ATTRIBUTE_ID: { in: attributeIds }, OA_BRAND_ID: command.oaBrandId },
        select: { OA_BRAND_SETTING_ATTRIBUTE_ID: true, SETTING_ATTRIBUTE_ID: true },
        orderBy: { OA_BRAND_SETTING_ATTRIBUTE_ID: 'asc' },
      }),
      prisma.$queryRaw<Array<{ attr: number; answerGroup: number | null; settingGroup: number | null }>>`
        SELECT a."SETTING_ATTRIBUTE_ID" AS attr, a."ANSWER_GROUP_ID" AS "answerGroup", h."SETTING_GROUP_ID" AS "settingGroup"
        FROM setting_group_attribute_mst a
        LEFT JOIN setting_group_section_header_mst h ON h."SETTING_GROUP_SECTION_HEADER_ID" = a."SETTING_GROUP_SECTION_HEADER_ID"
        WHERE a."SETTING_ATTRIBUTE_ID" = ANY(${attributeIds}::int[])`,
    ]);
    // CI upsert updates the FIRST row of (attribute, brand) found.
    const rowOf = new Map<number, number>();
    for (const r of existing) if (r.SETTING_ATTRIBUTE_ID != null && !rowOf.has(r.SETTING_ATTRIBUTE_ID)) rowOf.set(r.SETTING_ATTRIBUTE_ID, r.OA_BRAND_SETTING_ATTRIBUTE_ID);
    const metaOf = new Map(meta.map((m) => [m.attr, m]));
    const toInsert = attributeIds.filter((id) => !rowOf.has(id));
    if (toInsert.length) await assertInsertSafe('oa_brand_setting_attribute_mst', 'OA_BRAND_SETTING_ATTRIBUTE_ID');

    const oaId = command.oaId ?? (await this.oaIdOfBrand(command.oaBrandId));
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      for (const [attributeId, rowId] of rowOf) {
        await tx.oa_brand_setting_attribute_mst.update({
          where: { OA_BRAND_SETTING_ATTRIBUTE_ID: rowId },
          // CI set only the value; UPDATED_BY / UPDATED_ON are filled too (behaviour change: audit trail).
          data: { SETTING_ATTRIBUTE_OPTIONS_ID: byAttribute.get(attributeId) ?? '', UPDATED_BY: command.userId, UPDATED_ON: now },
        });
      }
      if (toInsert.length) {
        await tx.oa_brand_setting_attribute_mst.createMany({
          data: toInsert.map((attributeId) => ({
            SETTING_GROUP_ID: metaOf.get(attributeId)?.settingGroup ?? 0,
            SETTING_ATTRIBUTE_ID: attributeId,
            ANSWER_GROUP_ID: metaOf.get(attributeId)?.answerGroup ?? null,
            SETTING_ATTRIBUTE_OPTIONS_ID: byAttribute.get(attributeId) ?? '',
            COMMENT: null,
            OA_ID: oaId,
            OA_BRAND_ID: command.oaBrandId,
            CREATED_BY: command.userId,
            CREATED_ON: now,
          })),
        });
      }
    });
    return { updated: rowOf.size, inserted: toInsert.length };
  }

  async replaceWithDefaults(command: { oaId: number | null; oaBrandId: number; userId: number }): Promise<{ copied: number }> {
    const defaults = await prisma.oa_brand_setting_attribute_mst.count({ where: { OA_BRAND_ID: 0 } });
    if (defaults === 0) {
      // CI deleted the brand's settings first and then copied nothing (behaviour change: refused).
      throw new BusinessRuleError('There are no default (system) settings to sync from; nothing was changed.', 'NO_DEFAULT_SETTINGS');
    }
    if (command.oaBrandId === 0) {
      // CI with brand 0 would delete the system defaults themselves and copy nothing back.
      throw new BusinessRuleError('The system settings cannot be synced onto themselves.', 'SYNC_SYSTEM_BRAND');
    }
    await assertInsertSafe('oa_brand_setting_attribute_mst', 'OA_BRAND_SETTING_ATTRIBUTE_ID');
    const oaId = command.oaId ?? (await this.oaIdOfBrand(command.oaBrandId));
    const copied = await prisma.$transaction(async (tx) => {
      // CI clearSettings + INSERT … SELECT … WHERE OA_BRAND_ID = 0, now atomic.
      await tx.oa_brand_setting_attribute_mst.deleteMany({ where: { OA_BRAND_ID: command.oaBrandId } });
      return tx.$executeRaw`
        INSERT INTO oa_brand_setting_attribute_mst ("SETTING_GROUP_ID", "SETTING_ATTRIBUTE_ID", "ANSWER_GROUP_ID",
          "SETTING_ATTRIBUTE_OPTIONS_ID", "COMMENT", "OA_ID", "OA_BRAND_ID", "CREATED_BY", "CREATED_ON")
        SELECT d."SETTING_GROUP_ID", d."SETTING_ATTRIBUTE_ID", d."ANSWER_GROUP_ID", d."SETTING_ATTRIBUTE_OPTIONS_ID", d."COMMENT",
          ${oaId}, ${command.oaBrandId}, ${command.userId}, ${new Date()}
        FROM oa_brand_setting_attribute_mst d
        WHERE d."OA_BRAND_ID" = 0`;
    });
    return { copied };
  }

  // ------------------------------------------------------------------ helpers

  private async attributeIdsForCode(code: string): Promise<number[]> {
    const rows = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT DISTINCT a."SETTING_ATTRIBUTE_ID" AS id
      FROM setting_group_attribute_mst a
      WHERE a."IS_DELETED" = 0
        AND a."SYSTEM_SETTING_ATTRIBUTE_ID" IN (SELECT im."MSTR_ID" FROM independent_mst im WHERE im."MSTR_CD" = ${code})`;
    return rows.map((r) => r.id);
  }

  /** CI oa_brands_m::getOaId($brand). */
  private async oaIdOfBrand(oaBrandId: number): Promise<number> {
    if (oaBrandId === 0) return 0;
    const brand = await prisma.oa_brands.findFirst({ where: { OA_BRAND_ID: oaBrandId }, select: { OA_ID: true } });
    return brand?.OA_ID ?? 0;
  }
}

function toAttribute(r: Record<string, number | string | null>): AttributeRecord {
  const num = (v: number | string | null) => (v === null || v === undefined || v === '' ? null : Number(v));
  return {
    attributeId: Number(r.SETTING_ATTRIBUTE_ID),
    headerId: Number(r.SETTING_GROUP_SECTION_HEADER_ID),
    code: r.SYSTEM_SETTING_ATTRIBUTE_CD === null ? null : String(r.SYSTEM_SETTING_ATTRIBUTE_CD).trim(),
    label: String(r.SETTING_ATTRIBUTE_DESC ?? '').trim(),
    inputValueTypeId: num(r.SETTING_INPUT_VALUE_TYPE_ID),
    inputOptionTypeId: num(r.INPUT_OPTION_TYPE_ID),
    dataTypeId: num(r.GLOBAL_SETTING_DATA_TYPE_ID),
    answerGroupId: num(r.ANSWER_GROUP_ID),
    systemTypeId: num(r.SYSTEM_TYPE_ID),
    dependsOn: num(r.DEPENDENT_ON_ATTRIBUTE_ID),
  };
}
