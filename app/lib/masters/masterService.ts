import { prisma } from '@/lib/prisma';

/**
 * Master data (independent_mst / common_type) — the Prisma port of CI indp_mst_data_m /
 * common_type_m lookups. One place for "code → id", "type → options" and "ids → names".
 *
 * Data notes (migrated database):
 *  - many master rows exist twice (double import) → results are de-duplicated by MSTR_ID, and
 *    the lowest MSTR_ID wins when a code resolves to several ids;
 *  - MSTR_CD is NOT unique across types (e.g. 'USD' = "US Dollar" (type 131) and "Deactivated"
 *    (type 46, user status)). Pass `typeId` / `sameTypeAs` whenever the code family is known.
 */

export interface MasterOption {
  value: number;
  label: string;
  code: string | null;
}

const NOT_DELETED = { OR: [{ IS_DELETED: false }, { IS_DELETED: null }] };

const codeCache = new Map<string, number | null>();

/** CI getMasterIDFromCode(code). */
export async function getMasterId(code: string, opts: { typeId?: number } = {}): Promise<number | null> {
  const key = `${opts.typeId ?? '*'}:${code}`;
  if (codeCache.has(key)) return codeCache.get(key)!;
  const row = await prisma.independent_mst.findFirst({
    where: { MSTR_CD: code, ...(opts.typeId ? { TYP_ID: opts.typeId } : {}), ...NOT_DELETED },
    select: { MSTR_ID: true },
    orderBy: { MSTR_ID: 'asc' },
  });
  const id = row?.MSTR_ID ?? null;
  codeCache.set(key, id);
  return id;
}

/** Resolves several codes of the same family at once: { code → id }. */
export async function getMasterIds(codes: string[], opts: { typeId?: number } = {}): Promise<Record<string, number | null>> {
  const entries = await Promise.all(codes.map(async (c) => [c, await getMasterId(c, opts)] as const));
  return Object.fromEntries(entries);
}

/** id → code (e.g. user status id → 'USA'). */
export async function getMasterCode(id: number | null | undefined): Promise<string | null> {
  if (!id) return null;
  const row = await prisma.independent_mst.findFirst({ where: { MSTR_ID: id }, select: { MSTR_CD: true } });
  return row?.MSTR_CD ?? null;
}

/** Type id of a known code, e.g. typeIdOf('USA') → the user-status type. */
export async function typeIdOf(code: string): Promise<number | null> {
  const row = await prisma.independent_mst.findFirst({
    where: { MSTR_CD: code, ...NOT_DELETED },
    select: { TYP_ID: true },
    orderBy: { MSTR_ID: 'asc' },
  });
  return row?.TYP_ID ?? null;
}

/** Dropdown options of one master type (CI getAllIndpMstDataByTypeId / GROUP BY MSTR_NM ORDER BY SEQUENCE). */
export async function getMasterOptionsByType(typeId: number): Promise<MasterOption[]> {
  const rows = await prisma.independent_mst.findMany({
    where: { TYP_ID: typeId, ...NOT_DELETED },
    select: { MSTR_ID: true, MSTR_NM: true, MSTR_CD: true },
    orderBy: [{ SEQUENCE: 'asc' }, { MSTR_NM: 'asc' }, { MSTR_ID: 'asc' }],
  });
  const seenIds = new Set<number>();
  const seenNames = new Set<string>();
  const options: MasterOption[] = [];
  for (const r of rows) {
    if (seenIds.has(r.MSTR_ID) || seenNames.has(r.MSTR_NM)) continue;
    seenIds.add(r.MSTR_ID);
    seenNames.add(r.MSTR_NM);
    options.push({ value: r.MSTR_ID, label: r.MSTR_NM, code: r.MSTR_CD });
  }
  return options;
}

/** Options of the master type identified by common_type.TYP_CD (e.g. 'USQ' security questions). */
export async function getMasterOptionsByTypeCode(typeCode: string): Promise<MasterOption[]> {
  const type = await prisma.common_type.findFirst({ where: { TYP_CD: typeCode }, select: { TYP_ID: true } });
  return type ? getMasterOptionsByType(type.TYP_ID) : [];
}

/** common_type children of a parent type (CI common_type_m getDataByParentTypeID). */
export async function getCommonTypeOptionsByParent(parentTypeId: number): Promise<MasterOption[]> {
  const rows = await prisma.common_type.findMany({
    where: { PARENT_TYP_ID: parentTypeId, OR: [{ IS_DELETED: false }, { IS_DELETED: null }] },
    select: { TYP_ID: true, TYP_NM: true, TYP_CD: true },
    orderBy: [{ TYP_NM: 'asc' }, { TYP_ID: 'asc' }],
  });
  const seen = new Set<number>();
  return rows
    .filter((r) => (seen.has(r.TYP_ID) ? false : (seen.add(r.TYP_ID), true)))
    .map((r) => ({ value: r.TYP_ID, label: r.TYP_NM, code: r.TYP_CD }));
}

/** Batch id → name maps, for list enrichment without N+1 queries. */
export async function masterNames(ids: Array<number | null | undefined>): Promise<Map<number, { name: string; code: string | null }>> {
  const unique = [...new Set(ids.filter((i): i is number => typeof i === 'number'))];
  if (!unique.length) return new Map();
  const rows = await prisma.independent_mst.findMany({
    where: { MSTR_ID: { in: unique } },
    select: { MSTR_ID: true, MSTR_NM: true, MSTR_CD: true },
  });
  return new Map(rows.map((r) => [r.MSTR_ID, { name: r.MSTR_NM, code: r.MSTR_CD }]));
}

export async function commonTypeNames(ids: Array<number | null | undefined>): Promise<Map<number, string>> {
  const unique = [...new Set(ids.filter((i): i is number => typeof i === 'number'))];
  if (!unique.length) return new Map();
  const rows = await prisma.common_type.findMany({
    where: { TYP_ID: { in: unique } },
    select: { TYP_ID: true, TYP_NM: true },
  });
  return new Map(rows.map((r) => [r.TYP_ID, r.TYP_NM]));
}
