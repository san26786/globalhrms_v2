import { Prisma } from '@/generated/prisma/client';
import { getMasterOptionsByType, getMasterOptionsByTypeCode } from '@/lib/masters/masterService';
import { prisma } from '@/lib/prisma';
import type { IdLabel } from '@/lib/systmMngt/shared';

/** Dropdown loaders shared by the Employee Hub record screens (CI indp_mst_data_m / period_mst_m). */

const asIdLabel = (list: Array<{ value: number; label: string }>): IdLabel[] => list.map((o) => ({ value: o.value, label: o.label }));

/** CI getAllIndMstDetailsByTypeCode(code). */
export const mastersByCode = (code: string) => getMasterOptionsByTypeCode(code).then(asIdLabel);

/** CI getAllIndMstDetailsByTypeId(id). */
export const mastersByType = (typeId: number) => getMasterOptionsByType(typeId).then(asIdLabel);

/**
 * Masters of a type (by id or code) for a brand: the brand's own and the shared ones (OA_BRAND_ID NULL),
 * one per name. Falls back to every brand's when the brand has none, as CI listed them unfiltered.
 */
export async function brandMasters(type: { id: number } | { code: string }, brand: number | null): Promise<IdLabel[]> {
  const typeFilter = 'id' in type ? Prisma.sql`im."TYP_ID" = ${type.id}` : Prisma.sql`im."TYP_ID" = (SELECT "TYP_ID" FROM common_type WHERE "TYP_CD" = ${type.code} ORDER BY "TYP_ID" LIMIT 1)`;
  const load = (brandOnly: boolean) => prisma.$queryRaw<Array<{ value: number; label: string; seq: number | null }>>`
    SELECT DISTINCT ON (im."MSTR_NM") im."MSTR_ID" AS value, im."MSTR_NM" AS label, im."SEQUENCE" AS seq
    FROM independent_mst im
    WHERE ${typeFilter} AND COALESCE(im."IS_DELETED", false) = false
      AND (${!brandOnly} OR im."OA_BRAND_ID" = ${brand ?? -1} OR im."OA_BRAND_ID" IS NULL)
    ORDER BY im."MSTR_NM", (im."OA_BRAND_ID" = ${brand ?? -1}) DESC NULLS LAST, im."MSTR_ID"`;
  let rows = await load(true);
  if (!rows.length) rows = await load(false);
  return rows
    .sort((a, b) => (a.seq ?? 1e9) - (b.seq ?? 1e9) || a.label.localeCompare(b.label))
    .map((r) => ({ value: Number(r.value), label: r.label }));
}

/** Adds the record's current choice when it has left the list (closed period, deleted master…). */
export async function keepCurrent(list: IdLabel[], current: unknown, label: (id: number) => Promise<string | null>): Promise<IdLabel[]> {
  const id = Number(current);
  if (!Number.isInteger(id) || id <= 0 || list.some((o) => o.value === id)) return list;
  return [...list, { value: id, label: (await label(id)) ?? `#${id}` }];
}

/** CI period_mst_m::getAllNotClosedPeriodDetails(OPTFY): the brand's open financial years, newest first. */
export async function financialYearOptions(brand: number | null): Promise<IdLabel[]> {
  const rows = await prisma.$queryRaw<Array<{ value: number; label: string | null }>>`
    SELECT p."PERIOD_ID" AS value, p."FISCAL_PERIOD_DESC" AS label
    FROM period_mst p
    WHERE p."PERIOD_TYPE_ID" = (SELECT "MSTR_ID" FROM independent_mst WHERE "MSTR_CD" = 'OPTFY' ORDER BY "MSTR_ID" LIMIT 1)
      AND p."PERIOD_STATUS_ID" IS DISTINCT FROM (SELECT "MSTR_ID" FROM independent_mst WHERE "MSTR_CD" = 'OPSIA' ORDER BY "MSTR_ID" LIMIT 1)
      AND p."PERIOD_ENDED" = false AND p."IS_DELETED" = 0
      AND (${brand}::int IS NULL OR p."OA_BRAND_ID" = ${brand}::int)
    ORDER BY p."PERIOD_START_DATE" DESC NULLS LAST, p."PERIOD_ID" DESC`;
  return rows.map((r) => ({ value: Number(r.value), label: r.label ?? `#${r.value}` }));
}

export async function periodLabel(id: number): Promise<string | null> {
  const row = await prisma.period_mst.findFirst({ where: { PERIOD_ID: id }, select: { FISCAL_PERIOD_DESC: true } });
  return row?.FISCAL_PERIOD_DESC ?? null;
}

export async function masterLabel(id: number): Promise<string | null> {
  const row = await prisma.independent_mst.findFirst({ where: { MSTR_ID: id }, select: { MSTR_NM: true } });
  return row?.MSTR_NM ?? null;
}

/** The brand's currencies (CI job_mst_m::getCurrName), one per name. */
export async function currencyOptions(brand: number | null): Promise<IdLabel[]> {
  const rows = await prisma.$queryRaw<Array<{ value: number; label: string }>>`
    SELECT DISTINCT ON (c."CURR_NAME") c."CURR_ID" AS value, c."CURR_NAME" AS label
    FROM currency_mst c WHERE c."IS_DELETED" = 0 AND c."OA_BRAND_ID" = ${brand ?? -1}
    ORDER BY c."CURR_NAME", c."CURR_ID"`;
  return rows.map((r) => ({ value: Number(r.value), label: r.label }));
}

export async function currencyLabel(id: number): Promise<string | null> {
  const row = await prisma.currency_mst.findFirst({ where: { CURR_ID: id }, select: { CURR_NAME: true } });
  return row?.CURR_NAME ?? null;
}

/** Masters of a type that belong to the brand itself (CI's brand-filtered lists: locations, calendars), oldest sequence first. */
export async function brandOnlyMasters(type: { id: number } | { code: string }, brand: number | null, opts: { enabledOnly?: boolean } = {}): Promise<IdLabel[]> {
  const typeFilter = 'id' in type ? Prisma.sql`im."TYP_ID" = ${type.id}` : Prisma.sql`im."TYP_ID" = (SELECT "TYP_ID" FROM common_type WHERE "TYP_CD" = ${type.code} ORDER BY "TYP_ID" LIMIT 1)`;
  const rows = await prisma.$queryRaw<Array<{ value: number; label: string }>>`
    SELECT im."MSTR_ID" AS value, im."MSTR_NM" AS label FROM independent_mst im
    WHERE ${typeFilter} AND im."OA_BRAND_ID" = ${brand ?? -1} AND COALESCE(im."IS_DELETED", false) = false
      AND (${!opts.enabledOnly} OR im."IS_ENABLED" = 1)
    ORDER BY im."SEQUENCE" NULLS LAST, im."MSTR_NM", im."MSTR_ID"`;
  return rows.map((r) => ({ value: Number(r.value), label: r.label }));
}
