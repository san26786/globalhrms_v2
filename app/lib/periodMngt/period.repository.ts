import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { getMasterOptionsByType } from '@/lib/masters/masterService';
import { PERIOD_TYPE_TYPE_ID } from './period.registry';
import type { IdName, PendingCheck, PeriodRecord, PeriodRepository, PeriodWrite } from './period.types';

/**
 * PostgreSQL side of periodMngt/period_mst (CI period_mst_m). Parameterised SQL only; dates are
 * yyyy-MM-dd strings at this boundary (period_mst stores DATE columns).
 *
 * Data notes: independent_mst holds duplicated rows (DISTINCT / LIMIT 1); period_mst.IS_VERIFIED /
 * PERIOD_ENDED are booleans and IS_LOCKED / IS_DELETED smallints here (MySQL tinyints in CI).
 */

const NOT_DELETED = Prisma.sql`COALESCE("IS_DELETED", 0) = 0`;

function ymd(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** yyyy-MM-dd → the UTC-midnight Date Prisma writes to a DATE column unchanged. */
function toDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

interface PeriodRow {
  PERIOD_ID: number;
  PERIOD_TYPE_ID: number | null;
  PERIOD_START_DATE: Date | null;
  PERIOD_END_DATE: Date | null;
  FISCAL_PERIOD_DESC: string | null;
  PERIOD_STATUS_ID: number | null;
  PERIOD_ENDED: boolean;
  IS_VERIFIED: boolean;
  IS_LOCKED: number;
  OA_ID: number;
  OA_BRAND_ID: number;
  USER_ID: number;
}

function toRecord(r: PeriodRow): PeriodRecord {
  return {
    periodId: r.PERIOD_ID,
    periodTypeId: r.PERIOD_TYPE_ID,
    periodStartDate: ymd(r.PERIOD_START_DATE),
    periodEndDate: ymd(r.PERIOD_END_DATE),
    fiscalPeriodDesc: r.FISCAL_PERIOD_DESC,
    periodStatusId: r.PERIOD_STATUS_ID,
    periodEnded: r.PERIOD_ENDED,
    isVerified: r.IS_VERIFIED,
    isLocked: r.IS_LOCKED === 1,
    oaId: r.OA_ID,
    oaBrandId: r.OA_BRAND_ID,
    userId: r.USER_ID,
  };
}

const ids = (list: number[]) => Prisma.join(list);

export class PrismaPeriodRepository implements PeriodRepository {
  async enabledPeriodTypes(oaBrandId: number, brandAppId: number, isSysAdmin: boolean): Promise<IdName[]> {
    // CI getEnabledPeriodType(): a period type belongs to a module (MODULE_CD); below sysadmin the
    // module must be licensed + enabled for the brand and mapped to the brand's application.
    const rows = isSysAdmin
      ? await prisma.$queryRaw<Array<{ value: number; label: string }>>`
          SELECT DISTINCT im."MSTR_ID" AS value, im."MSTR_NM" AS label
          FROM independent_mst im
          JOIN independent_mst im2 ON im."MODULE_CD" = im2."MSTR_CD"
          WHERE im."TYP_ID" = ${PERIOD_TYPE_TYPE_ID}
          ORDER BY im."MSTR_ID"`
      : await prisma.$queryRaw<Array<{ value: number; label: string }>>`
          SELECT DISTINCT im."MSTR_ID" AS value, im."MSTR_NM" AS label
          FROM independent_mst im
          JOIN independent_mst im2 ON im."MODULE_CD" = im2."MSTR_CD"
          JOIN "OA_Module_Config" omc ON omc."MSTR_ID" = im2."MSTR_ID"
          JOIN config_mapping_dtl cm ON cm."SRC_ENTTY_ID" = im2."MSTR_ID"
          JOIN independent_mst im3 ON im3."MSTR_ID" = cm."TRGT_ENTTY_ID"
          WHERE im."TYP_ID" = ${PERIOD_TYPE_TYPE_ID}
            AND omc."IS_ENABLED" AND omc."IS_LICENSED" AND omc."OA_BRAND_ID" = ${oaBrandId}
            AND (im3."APP_ID" IS NULL OR im3."APP_ID" = 0 OR im3."APP_ID" = ${brandAppId})
          ORDER BY im."MSTR_ID"`;
    return rows.map((r) => ({ value: Number(r.value), label: r.label }));
  }

  async mastersOfType(typeId: number): Promise<IdName[]> {
    // CI getDataByTypeID(typeId) — the shared master lookup (de-duplicates the doubled master rows).
    const options = await getMasterOptionsByType(typeId);
    return options.map((o) => ({ value: o.value, label: o.label }));
  }

  async brandOrgId(oaBrandId: number): Promise<number | null> {
    const row = await prisma.oa_brands.findFirst({ where: { OA_BRAND_ID: oaBrandId }, select: { OA_ID: true } });
    return row?.OA_ID ?? null;
  }

  async find(periodId: number, oaBrandId: number): Promise<PeriodRecord | null> {
    const row = await prisma.period_mst.findFirst({
      where: { PERIOD_ID: periodId, OA_BRAND_ID: oaBrandId, IS_DELETED: 0 },
    });
    return row ? toRecord(row) : null;
  }

  async periodCovering(args: { periodTypeId: number; date: string; oaBrandId: number; activeStatusId: number | null }): Promise<number | null> {
    const status = args.activeStatusId === null ? Prisma.empty : Prisma.sql`AND "PERIOD_STATUS_ID" = ${args.activeStatusId}`;
    const rows = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT "PERIOD_ID" AS id FROM period_mst
      WHERE "PERIOD_START_DATE" <= ${args.date}::date AND "PERIOD_END_DATE" >= ${args.date}::date
        AND "PERIOD_TYPE_ID" = ${args.periodTypeId} AND "OA_BRAND_ID" = ${args.oaBrandId} AND ${NOT_DELETED}
        ${status}
      ORDER BY "PERIOD_ID" LIMIT 1`;
    return rows[0]?.id ?? null;
  }

  async descriptionExists(fiscalPeriodDesc: string, exceptPeriodId: number | null): Promise<boolean> {
    const count = await prisma.period_mst.count({
      where: { FISCAL_PERIOD_DESC: fiscalPeriodDesc, ...(exceptPeriodId ? { NOT: { PERIOD_ID: exceptPeriodId } } : {}) },
    });
    return count > 0;
  }

  async latestPeriod(args: { periodTypeId: number; oaBrandId: number; activeStatusId: number | null }): Promise<{ periodEndDate: string } | null> {
    const row = await prisma.period_mst.findFirst({
      where: {
        PERIOD_TYPE_ID: args.periodTypeId,
        OA_BRAND_ID: args.oaBrandId,
        IS_DELETED: 0,
        ...(args.activeStatusId !== null ? { PERIOD_STATUS_ID: args.activeStatusId } : {}),
      },
      orderBy: [{ PERIOD_START_DATE: { sort: 'desc', nulls: 'last' } }, { PERIOD_ID: 'desc' }],
      select: { PERIOD_END_DATE: true },
    });
    const end = ymd(row?.PERIOD_END_DATE ?? null);
    return end ? { periodEndDate: end } : null;
  }

  async latestEndDates(periodTypeIds: number[], oaBrandId: number): Promise<Map<number, string>> {
    if (!periodTypeIds.length) return new Map();
    const rows = await prisma.$queryRaw<Array<{ type_id: number; end_date: Date | null }>>`
      SELECT "PERIOD_TYPE_ID" AS type_id, MAX("PERIOD_END_DATE") AS end_date
      FROM period_mst
      WHERE "PERIOD_TYPE_ID" IN (${ids(periodTypeIds)}) AND "OA_BRAND_ID" = ${oaBrandId}
      GROUP BY "PERIOD_TYPE_ID"`;
    return new Map(rows.filter((r) => r.end_date).map((r) => [Number(r.type_id), ymd(r.end_date)!]));
  }

  async insert(row: PeriodWrite): Promise<number> {
    const created = await prisma.period_mst.create({
      data: {
        PERIOD_START_DATE: toDate(row.periodStartDate),
        PERIOD_END_DATE: toDate(row.periodEndDate),
        PERIOD_TYPE_ID: row.periodTypeId,
        FISCAL_PERIOD_DESC: row.fiscalPeriodDesc,
        PERIOD_STATUS_ID: row.periodStatusId,
        IS_VERIFIED: false,
        OA_BRAND_ID: row.oaBrandId,
        OA_ID: row.oaId,
        USER_ID: row.userId,
        CREATED_BY: row.actorId,
        CREATED_ON: row.now,
      },
      select: { PERIOD_ID: true },
    });
    return created.PERIOD_ID;
  }

  async update(periodId: number, row: PeriodWrite): Promise<void> {
    await prisma.period_mst.updateMany({
      where: { PERIOD_ID: periodId, OA_BRAND_ID: row.oaBrandId },
      data: {
        PERIOD_START_DATE: toDate(row.periodStartDate),
        PERIOD_END_DATE: toDate(row.periodEndDate),
        PERIOD_TYPE_ID: row.periodTypeId,
        PERIOD_STATUS_ID: row.periodStatusId,
        FISCAL_PERIOD_DESC: row.fiscalPeriodDesc,
        OA_BRAND_ID: row.oaBrandId,
        OA_ID: row.oaId,
        USER_ID: row.userId,
        UPDATED_BY: row.actorId,
        UPDATED_ON: row.now,
      },
    });
  }

  async referenceCount(periodIds: number[]): Promise<number> {
    if (!periodIds.length) return 0;
    // CI summed COUNT()s combined with UNION (equal counts collapsed) — only "> 0" matters, so
    // UNION ALL is used; deleted rows count too, as in CI.
    const rows = await prisma.$queryRaw<Array<{ total: bigint | number | null }>>`
      SELECT SUM(pcount) AS total FROM (
        SELECT COUNT(*) AS pcount FROM timesheet WHERE "PERIOD_ID" IN (${ids(periodIds)})
        UNION ALL SELECT COUNT(*) FROM leave_requests_dtl WHERE "LEAVE_PERIOD_ID" IN (${ids(periodIds)})
        UNION ALL SELECT COUNT(*) FROM outdrentr WHERE "OD_PERIOD_ID" IN (${ids(periodIds)})
        UNION ALL SELECT COUNT(*) FROM performance_review WHERE "PERIOD_ID" IN (${ids(periodIds)})
        UNION ALL SELECT COUNT(*) FROM achievment WHERE "PERIOD_ID" IN (${ids(periodIds)})
      ) t1`;
    return Number(rows[0]?.total ?? 0);
  }

  async softDelete(periodIds: number[], oaBrandId: number): Promise<number> {
    const r = await prisma.period_mst.updateMany({
      where: { PERIOD_ID: { in: periodIds }, OA_BRAND_ID: oaBrandId, IS_DELETED: 0 },
      data: { IS_DELETED: 1 },
    });
    return r.count;
  }

  async setLocked(periodIds: number[], oaBrandId: number, locked: boolean): Promise<number> {
    const r = await prisma.period_mst.updateMany({
      where: { PERIOD_ID: { in: periodIds }, OA_BRAND_ID: oaBrandId },
      data: { IS_LOCKED: locked ? 1 : 0 },
    });
    return r.count;
  }

  async countLocked(periodIds: number[], oaBrandId: number): Promise<number> {
    return prisma.period_mst.count({
      where: { PERIOD_ID: { in: periodIds }, OA_BRAND_ID: oaBrandId, IS_LOCKED: 1, IS_DELETED: 0 },
    });
  }

  async setVerified(periodIds: number[], oaBrandId: number): Promise<number> {
    const r = await prisma.period_mst.updateMany({
      where: { PERIOD_ID: { in: periodIds }, OA_BRAND_ID: oaBrandId },
      data: { IS_VERIFIED: true },
    });
    return r.count;
  }

  async countUnverified(periodIds: number[], oaBrandId: number): Promise<number> {
    return prisma.period_mst.count({
      where: { PERIOD_ID: { in: periodIds }, OA_BRAND_ID: oaBrandId, IS_VERIFIED: false },
    });
  }

  async endPeriods(periodIds: number[], oaBrandId: number, inactiveStatusId: number) {
    return prisma.$transaction(async (tx) => {
      await tx.period_mst.updateMany({
        where: { PERIOD_ID: { in: periodIds }, OA_BRAND_ID: oaBrandId },
        data: { PERIOD_ENDED: true, PERIOD_STATUS_ID: inactiveStatusId },
      });
      const rows = await tx.period_mst.findMany({
        where: { PERIOD_ID: { in: periodIds }, OA_BRAND_ID: oaBrandId },
        select: { PERIOD_ID: true, PERIOD_TYPE_ID: true },
      });
      return rows.map((r) => ({ periodId: r.PERIOD_ID, periodTypeId: r.PERIOD_TYPE_ID }));
    });
  }

  async pendingCount(check: PendingCheck, periodId: number): Promise<number> {
    // Identifiers come from the registry (never from input); values are bound.
    const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint | number }>>(
      `SELECT COUNT(*) AS n FROM "${check.table}"
       WHERE "${check.periodColumn}" = $1 AND "${check.statusColumn}" = ANY($2::int[])
         AND COALESCE("IS_DELETED"::text, '0') IN ('0', 'false')`, // smallint here, boolean in achievment
      periodId,
      check.statusIds,
    );
    return Number(rows[0]?.n ?? 0);
  }
}
