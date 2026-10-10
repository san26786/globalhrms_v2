import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { BusinessRuleError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/http/errors';
import { displayConfigSchema } from '@/validations/entity.schema';
import { ACTIVE, DELETED, findActiveObject, humanizeColumn } from '../entityShared';

/**
 * Column configuration of one entity object — the port of CI
 * entity_obj_attrbt::updateFlashModal() (+ models updateByFlash / updateByFlashForLV /
 * updateByFlashForForm) and common_c getLabel / resetLabelAsDefault / applyToAllBrands.
 *
 *  - system admin (2): global entity_obj_attrbt.IS_VISIBLE and the SYSTEM display rows
 *    (entity_obj_attrbt_dsply_dtl with OA_BRAND_ID NULL): label, list and form visibility;
 *    "apply to all brands" (soft-deletes every brand override of the object).
 *  - brand admin (1): upserts their brand's display rows (label / list / form visibility), only
 *    for globally visible attributes; "reset to default" copies the system labels back.
 *  - users (0): forbidden.
 * Label precedence for display: brand row → system row → humanised column name.
 *
 * Differences from CI (documented): writes are POST/PUT only (CI used GET links); "apply to all
 * brands" is system-admin only (CI had no role check) and soft-deletes instead of hard DELETE;
 * an unchecked box is stored as 0 (CI wrote NULL); display rows are matched to attributes by
 * OBJ_ATTRBT_ID, falling back to OBJ_NM + trimmed OBJ_ATTRBT_NM (tens of thousands of migrated rows
 * carry a stale OBJ_ATTRBT_ID or trailing spaces); duplicate rows of one scope are all updated.
 */

const DSPLY_TABLE = 'entity_obj_attrbt_dsply_dtl';
const DSPLY_PK = 'OBJ_ATTRBT_DSPLY_ID';

export interface DisplaySettings {
  label: string;
  listView: boolean;
  formView: boolean;
}

export interface DisplayConfigRow {
  attributeId: number;
  name: string;
  dataType: string;
  seq: number;
  /** Global visibility (entity_obj_attrbt.IS_VISIBLE). */
  isVisible: boolean;
  defaultLabel: string;
  system: DisplaySettings | null;
  brand: DisplaySettings | null;
  effective: DisplaySettings;
}

export interface DisplayConfig {
  objId: number;
  objNm: string;
  adminLevel: 1 | 2;
  brandId: number | null;
  /** Active brand override rows of the object (system admin view). */
  brandOverrideCount: number;
  rows: DisplayConfigRow[];
}

interface DsplyRow {
  OBJ_ATTRBT_DSPLY_ID: number;
  OBJ_ATTRBT_ID: number;
  OBJ_ATTRBT_NM: string;
  OBJ_ATTRBT_DSPLY_NM: string;
  IS_VISIBLE_FOR_LISTVIEW: number;
  IS_VISIBLE_FOR_FORMVIEW: number;
  OA_BRAND_ID: number | null;
}

interface AttributeRow {
  OBJ_ATTRBT_ID: number;
  OBJ_ATTRBT_NM: string;
  OBJ_ATTRBT_DT_TYP: string;
  OBJ_ATTRBT_SEQ: number;
  IS_VISIBLE: boolean | null;
}

interface Loaded {
  objId: number;
  objNm: string;
  level: 1 | 2;
  brandId: number | null;
  attributes: AttributeRow[];
  /** attributeId → display rows of the system scope / the caller's brand (lowest id first). */
  systemRows: Map<number, DsplyRow[]>;
  brandRows: Map<number, DsplyRow[]>;
  brandOverrideCount: number;
}

function requireConfigurer(subject: RequestSubject): 1 | 2 {
  if (subject.adminLevel === 0) throw new ForbiddenError('Only administrators can configure columns.');
  return subject.adminLevel;
}

const norm = (s: string) => s.trim().toUpperCase();

async function load(subject: RequestSubject, rawObjId: string, forViewer = false): Promise<Loaded> {
  // A viewer (columns()) reads with the brand scope unless they are the super admin.
  const level: 1 | 2 = forViewer ? (subject.adminLevel === 2 ? 2 : 1) : requireConfigurer(subject);
  const objId = Number(rawObjId);
  if (!Number.isInteger(objId) || objId <= 0) throw new ValidationError('Invalid id.', { id: ['Must be a positive integer.'] });
  const object = await findActiveObject(objId);
  if (!object) throw new NotFoundError('Entity object not found.');

  const brandId = level === 1 ? subject.oaBrandId : null;
  if (level === 1 && brandId === null && !forViewer) {
    throw new BusinessRuleError('Your session has no active brand; column configuration is per brand.', 'NO_ACTIVE_BRAND');
  }

  const [attributes, dsply, brandOverrideCount] = await Promise.all([
    prisma.entity_obj_attrbt.findMany({
      where: { OBJ_NM: object.OBJ_NM, IS_DELETED: ACTIVE },
      select: { OBJ_ATTRBT_ID: true, OBJ_ATTRBT_NM: true, OBJ_ATTRBT_DT_TYP: true, OBJ_ATTRBT_SEQ: true, IS_VISIBLE: true },
      orderBy: [{ OBJ_ATTRBT_SEQ: 'asc' }, { OBJ_ATTRBT_ID: 'asc' }],
    }),
    prisma.entity_obj_attrbt_dsply_dtl.findMany({
      where: {
        OBJ_NM: object.OBJ_NM,
        IS_DELETED: ACTIVE,
        OR: [{ OA_BRAND_ID: null }, ...(brandId !== null ? [{ OA_BRAND_ID: brandId }] : [])],
      },
      select: {
        OBJ_ATTRBT_DSPLY_ID: true,
        OBJ_ATTRBT_ID: true,
        OBJ_ATTRBT_NM: true,
        OBJ_ATTRBT_DSPLY_NM: true,
        IS_VISIBLE_FOR_LISTVIEW: true,
        IS_VISIBLE_FOR_FORMVIEW: true,
        OA_BRAND_ID: true,
      },
      orderBy: { OBJ_ATTRBT_DSPLY_ID: 'asc' },
    }),
    level === 2
      ? prisma.entity_obj_attrbt_dsply_dtl.count({ where: { OBJ_NM: object.OBJ_NM, IS_DELETED: ACTIVE, NOT: { OA_BRAND_ID: null } } })
      : Promise.resolve(0),
  ]);

  const ids = new Set(attributes.map((a) => a.OBJ_ATTRBT_ID));
  const idByName = new Map<string, number>();
  for (const a of attributes) if (!idByName.has(norm(a.OBJ_ATTRBT_NM))) idByName.set(norm(a.OBJ_ATTRBT_NM), a.OBJ_ATTRBT_ID);

  const systemRows = new Map<number, DsplyRow[]>();
  const brandRows = new Map<number, DsplyRow[]>();
  for (const row of dsply) {
    const attributeId = ids.has(row.OBJ_ATTRBT_ID) ? row.OBJ_ATTRBT_ID : idByName.get(norm(row.OBJ_ATTRBT_NM));
    if (attributeId === undefined) continue;
    const target = row.OA_BRAND_ID === null ? systemRows : brandRows;
    const list = target.get(attributeId) ?? [];
    list.push(row);
    target.set(attributeId, list);
  }

  return { objId, objNm: object.OBJ_NM, level, brandId, attributes, systemRows, brandRows, brandOverrideCount };
}

function settings(row: DsplyRow | undefined): DisplaySettings | null {
  if (!row) return null;
  return {
    label: row.OBJ_ATTRBT_DSPLY_NM.trim(),
    listView: Number(row.IS_VISIBLE_FOR_LISTVIEW) === 1,
    formView: Number(row.IS_VISIBLE_FOR_FORMVIEW) === 1,
  };
}

function toConfig(data: Loaded): DisplayConfig {
  return {
    objId: data.objId,
    objNm: data.objNm,
    adminLevel: data.level,
    brandId: data.brandId,
    brandOverrideCount: data.brandOverrideCount,
    rows: data.attributes.map((a) => {
      const system = settings(data.systemRows.get(a.OBJ_ATTRBT_ID)?.[0]);
      const brand = settings(data.brandRows.get(a.OBJ_ATTRBT_ID)?.[0]);
      const defaultLabel = humanizeColumn(a.OBJ_ATTRBT_NM);
      return {
        attributeId: a.OBJ_ATTRBT_ID,
        name: a.OBJ_ATTRBT_NM,
        dataType: a.OBJ_ATTRBT_DT_TYP,
        seq: a.OBJ_ATTRBT_SEQ,
        isVisible: a.IS_VISIBLE === true,
        defaultLabel,
        system,
        brand,
        effective: {
          label: brand?.label || system?.label || defaultLabel,
          listView: brand?.listView ?? system?.listView ?? true,
          formView: brand?.formView ?? system?.formView ?? true,
        },
      };
    }),
  };
}

async function nextSequence(tx: Prisma.TransactionClient, objNm: string): Promise<number> {
  const max = await tx.entity_obj_attrbt_dsply_dtl.aggregate({ where: { OBJ_NM: objNm }, _max: { OBJ_ATTRBT_SEQ: true } });
  return (max._max.OBJ_ATTRBT_SEQ ?? 0) + 1;
}

const bit = (v: boolean) => (v ? 1 : 0);

export interface ListColumn {
  /** OBJ_ATTRBT_NM — the column name the list row carries. */
  name: string;
  label: string;
  visibleInList: boolean;
  visibleInForm: boolean;
}

export const displayConfigService = {
  /**
   * The list columns every caller sees (CI getTableDtl tableHeader): super admin → globally visible
   * attributes (getVisibleCol); others → the effective brand / system list flag (getVisibleColForLV),
   * limited to globally visible attributes. Labels follow brand → system → humanised name.
   */
  async columns(subject: RequestSubject, objId: string): Promise<ListColumn[]> {
    const data = await load(subject, objId, true);
    return toConfig(data).rows.map((r) => ({
      name: r.name,
      label: r.effective.label,
      // CI getVisibleCol (level 2): IS_VISIBLE only. getVisibleColForLV (others): IS_VISIBLE and the
      // BRAND row's list flag is not "0" (no brand row = shown; the system list flag is not consulted).
      visibleInList: data.level === 2 ? r.isVisible : r.isVisible && (r.brand?.listView ?? true),
      visibleInForm: r.effective.formView,
    }));
  },

  async get(subject: RequestSubject, objId: string): Promise<DisplayConfig> {
    return toConfig(await load(subject, objId));
  },

  /** Saves the rows sent (only the fields present in each row change). */
  async save(subject: RequestSubject, objId: string, body: unknown): Promise<DisplayConfig> {
    const input = displayConfigSchema.parse(body);
    const data = await load(subject, objId);
    const attributes = new Map(data.attributes.map((a) => [a.OBJ_ATTRBT_ID, a]));

    const foreign = input.rows.filter((r) => !attributes.has(r.attributeId)).map((r) => r.attributeId);
    if (foreign.length) {
      throw new ValidationError(`Attribute(s) ${foreign.join(', ')} do not belong to "${data.objNm}".`);
    }
    if (data.level === 1) {
      if (input.rows.some((r) => r.isVisible !== undefined)) {
        throw new ForbiddenError('Only the system administrator can change global column visibility.');
      }
      const hidden = input.rows.filter((r) => attributes.get(r.attributeId)?.IS_VISIBLE !== true);
      if (hidden.length) {
        throw new BusinessRuleError(
          `Column(s) ${hidden.map((r) => attributes.get(r.attributeId)?.OBJ_ATTRBT_NM).join(', ')} are hidden globally and cannot be configured per brand.`,
          'ATTRIBUTE_NOT_VISIBLE',
        );
      }
    }

    const scopeRows = data.level === 2 ? data.systemRows : data.brandRows;
    const needsInsert = input.rows.some(
      (r) => !scopeRows.get(r.attributeId)?.length && (r.label !== undefined || r.listView !== undefined || r.formView !== undefined),
    );
    if (needsInsert) await assertInsertSafe(DSPLY_TABLE, DSPLY_PK);

    await prisma.$transaction(async (tx) => {
      let seq: number | null = null;
      for (const row of input.rows) {
        const attribute = attributes.get(row.attributeId)!;

        if (data.level === 2 && row.isVisible !== undefined) {
          await tx.entity_obj_attrbt.updateMany({
            where: { OBJ_ATTRBT_ID: row.attributeId, OBJ_NM: data.objNm, IS_DELETED: ACTIVE },
            data: { IS_VISIBLE: row.isVisible },
          });
        }

        const changes: Prisma.entity_obj_attrbt_dsply_dtlUpdateManyMutationInput = {
          ...(row.label !== undefined ? { OBJ_ATTRBT_DSPLY_NM: row.label } : {}),
          ...(row.listView !== undefined ? { IS_VISIBLE_FOR_LISTVIEW: bit(row.listView) } : {}),
          ...(row.formView !== undefined ? { IS_VISIBLE_FOR_FORMVIEW: bit(row.formView) } : {}),
        };
        if (!Object.keys(changes).length) continue;

        const existing = scopeRows.get(row.attributeId) ?? [];
        if (existing.length) {
          await tx.entity_obj_attrbt_dsply_dtl.updateMany({
            where: { OBJ_ATTRBT_DSPLY_ID: { in: existing.map((e) => e.OBJ_ATTRBT_DSPLY_ID) }, OA_BRAND_ID: data.brandId },
            data: changes,
          });
          continue;
        }

        // New row — defaults inherit the system row (CI copied the system label or the column name).
        const system = settings(data.systemRows.get(row.attributeId)?.[0]);
        seq = seq === null ? await nextSequence(tx, data.objNm) : seq + 1;
        await tx.entity_obj_attrbt_dsply_dtl.create({
          data: {
            OBJ_ATTRBT_ID: attribute.OBJ_ATTRBT_ID,
            OBJ_NM: data.objNm,
            OBJ_ATTRBT_NM: attribute.OBJ_ATTRBT_NM,
            OBJ_ATTRBT_DSPLY_NM: row.label ?? system?.label ?? humanizeColumn(attribute.OBJ_ATTRBT_NM),
            IS_VISIBLE_FOR_LISTVIEW: bit(row.listView ?? system?.listView ?? true),
            IS_VISIBLE_FOR_FORMVIEW: bit(row.formView ?? system?.formView ?? true),
            OA_ID: data.level === 1 ? subject.oaId : null,
            OA_BRAND_ID: data.brandId,
            USER_ID: subject.userId,
            IS_DELETED: ACTIVE,
            OBJ_ATTRBT_SEQ: seq,
          },
        });
      }
    });

    return toConfig(await load(subject, objId));
  },

  /** CI resetLabelAsDefault — brand admin: the brand's labels are replaced by the system labels. */
  async resetToDefault(subject: RequestSubject, objId: string): Promise<{ updated: number; config: DisplayConfig }> {
    if (subject.adminLevel !== 1) throw new ForbiddenError('Reset to default applies to a brand administrator’s own labels.');
    const data = await load(subject, objId);
    let updated = 0;
    await prisma.$transaction(async (tx) => {
      for (const a of data.attributes) {
        if (a.IS_VISIBLE !== true) continue;
        const rows = data.brandRows.get(a.OBJ_ATTRBT_ID);
        if (!rows?.length) continue;
        const label = settings(data.systemRows.get(a.OBJ_ATTRBT_ID)?.[0])?.label || humanizeColumn(a.OBJ_ATTRBT_NM);
        const result = await tx.entity_obj_attrbt_dsply_dtl.updateMany({
          where: { OBJ_ATTRBT_DSPLY_ID: { in: rows.map((r) => r.OBJ_ATTRBT_DSPLY_ID) }, OA_BRAND_ID: data.brandId },
          data: { OBJ_ATTRBT_DSPLY_NM: label },
        });
        updated += result.count;
      }
    });
    return { updated, config: toConfig(await load(subject, objId)) };
  },

  /**
   * CI applyToAllBrands — system admin only: every brand override of the object is soft-deleted,
   * so all brands fall back to the system configuration.
   */
  async applyToAllBrands(subject: RequestSubject, objId: string): Promise<{ removed: number; config: DisplayConfig }> {
    if (subject.adminLevel !== 2) throw new ForbiddenError('Only the system administrator can apply a configuration to all brands.');
    const data = await load(subject, objId);
    const result = await prisma.entity_obj_attrbt_dsply_dtl.updateMany({
      where: { OBJ_NM: data.objNm, IS_DELETED: ACTIVE, NOT: { OA_BRAND_ID: null } },
      data: { IS_DELETED: DELETED },
    });
    return { removed: result.count, config: toConfig(await load(subject, objId)) };
  },
};
