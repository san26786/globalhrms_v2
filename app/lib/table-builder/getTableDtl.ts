// app/lib/table-builder/getTableDtl.ts
//
// Generic "list view" data builder — TypeScript port of the CodeIgniter
// `common_helper::getTableDtl()` function + the `Entity_obj_attrbt_m`
// metadata methods it calls (getVisibleCol / getVisibleColForLV /
// getAllEntityObjAttrbt / getAllEntityObjAttrbtDtl / getAllEntityObjAttrbtForLV /
// getAllEntityObjAttrbtForFV).
//
// This is a plain function (not a class, not React) so it can be called from
// any Server Component, Route Handler, or Server Action. It only ever
// receives/returns plain values/props — no `$this`, no session super-global,
// no CI `$this->db` query builder — so it is safe to reuse for every module
// (menus, assets, HR, finance, …) exactly like the original CI helper was.
//
// NOTE: raw dynamic-table SQL is built with `$queryRawUnsafe` + `?`
// placeholders rather than the `Prisma.sql`/`Prisma.raw`/`Prisma.join` tag
// helpers — this project's generated client output doesn't expose those.
// Every identifier (table/column name) is still allow-listed before being
// concatenated in, and every *value* is still a bound parameter, so this
// keeps the same injection-safety property, just via a different API.

import { prisma } from "@/lib/prisma";
import { buildTable } from "./tableBuilder";
import type { DisplayField } from "./columnBuilder";
import type { TableFilter } from "./filterBuilder";
import type { TableAction } from "./actionBuilder";
import type { TableDefinition } from "./tableTypes";

/* ============================================================================
   Types
   ========================================================================== */

/** Mirrors CI's `$this->session->userdata('is_admin')`. */
export type AdminLevel = 0 | 1 | 2; // 0 = normal user, 1 = org/brand admin, 2 = super admin

/**
 * Replaces the CI super-global session. The caller (a Route Handler /
 * Server Component that already knows who's logged in) passes this in
 * explicitly instead of the helper reaching into global state.
 */
export interface TableDtlSession {
  isAdmin: AdminLevel;
  oaId?: number | string | null;
  oaBrandId?: number | string | null;
  userId?: number | string | null;
}

type FilterValue = string | number | boolean | null;

export interface GetTableDtlParams {
  /** pvs_ObjNm — the DB table / view this listing reads from. */
  objNm: string;
  /** primaryKeyColumn — defaults to 'ID' like the CI controller did. */
  primaryKeyColumn?: string;

  /** colNm / colValue — extra static WHERE column(s), single or array. */
  colNm?: string | string[];
  colValue?: FilterValue | FilterValue[];

  /** Org/brand scoping — applied only when session.isAdmin === 1. */
  orgColumnName?: string;
  orgId?: FilterValue;

  /** "Only show my own rows" scoping — applied when session.isAdmin === 0. */
  userColumnName?: string;
  userId?: FilterValue;

  /** Approver scoping — applied when session.isAdmin === 0 and approverId === session.userId. */
  approverColumnName?: string;
  approverId?: FilterValue;

  /** Dropdown / secondary filter, e.g. status dropdown above the list. */
  dropDownDbColumn?: string;
  dropDownListValue?: FilterValue;

  /** Row actions (edit/delete/...) — fed straight into table-builder's actionBuilder. */
  actions?: TableAction[];
  /** Toolbar filters — fed straight into table-builder's filterBuilder. */
  filters?: TableFilter[];

  /** Pagination (optional — omit to fetch everything, matching legacy default). */
  page?: number;
  limit?: number;

  session: TableDtlSession;
}

export interface TableDtlResult<T = Record<string, unknown>> {
  objNm: string;
  primaryKeyColumn: string;

  /**
   * Opaque state token. Replaces PHP's
   * `urlencode(serialize(compact(...)))`. Round-trips through
   * `decodeTableDtlToken()` so it can be handed to edit/detail links the
   * same way `$data['primaryKeyValue']` was.
   */
  primaryKeyValue: string;

  /** getVisibleCol() / getVisibleColForLV() — display names, in column order. */
  tableHeader: string[];

  /** getAllEntityObjAttrbtDtl() — OBJ_ATTRBT_ID -> display name. */
  entityObjAttrbtDetails: Record<number, string>;

  /** getAllEntityObjAttrbt() — the raw attribute metadata rows. */
  getSystemData: EntityObjAttrbtRow[];

  /** getAllEntityObjAttrbtForLV() — OBJ_ATTRBT_ID -> IS_VISIBLE_FOR_LISTVIEW. */
  getVisibleColForLV: Record<number, boolean | null>;

  /** getAllEntityObjAttrbtForFV() — OBJ_ATTRBT_ID -> IS_VISIBLE_FOR_FORMVIEW. */
  getVisibleColForFV: Record<number, boolean | null>;

  /** The actual list rows (equivalent of CI's paginated `$data['tableBody']`). */
  tableBody: T[];
  total: number;

  /** Ready-to-render TanStack columns/filters/actions for <DataTable />. */
  table: TableDefinition<T>;
}

interface EntityObjAttrbtRow {
  OBJ_ATTRBT_ID: number;
  OBJ_ATTRBT_NM: string;
  OBJ_NM: string;
  OBJ_ATTRBT_SEQ: number | null;
  IS_VISIBLE: boolean | null;
}

/** Local shape for the display-detail rows we auto-provision. Kept as a
 *  plain interface (not `Prisma.<Model>CreateManyInput`) since that type
 *  name isn't exported by this project's generated client output. */
interface DsplyDtlProvisionRow {
  OBJ_ATTRBT_ID: number;
  OBJ_NM: string;
  OBJ_ATTRBT_NM: string;
  OBJ_ATTRBT_DSPLY_NM: string;
  IS_VISIBLE_FOR_LISTVIEW: number;
  IS_VISIBLE_FOR_FORMVIEW: number;
  OA_ID: number | null;
  OA_BRAND_ID: number;
  USER_ID: number | null;
}

/* ============================================================================
   Small helpers
   ========================================================================== */

/** Only letters, digits, underscore — used to validate dynamic table/column
 *  identifiers before they're ever concatenated into raw SQL. Anything that
 *  doesn't match is rejected instead of being interpolated, which is the one
 *  thing the original CI code (string-concatenated WHEREs) did NOT do. */
const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function assertSafeIdentifier(name: string, label: string): string {
  if (!SAFE_IDENTIFIER.test(name)) {
    throw new Error(`getTableDtl: unsafe ${label} identifier "${name}"`);
  }
  return name;
}

/** Backtick-quoted, allow-listed identifier for raw SQL string-building. */
function ident(name: string, label = "column"): string {
  return `\`${assertSafeIdentifier(name, label)}\``;
}

export function encodeTableDtlToken(params: GetTableDtlParams): string {
  const { session, ...rest } = params;
  return Buffer.from(JSON.stringify(rest)).toString("base64url");
}

export function decodeTableDtlToken(
  token: string
): Omit<GetTableDtlParams, "session"> {
  return JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
}

/* ============================================================================
   1. getVisibleCol()  /  getVisibleColForLV()
   ------------------------------------------------------------------------
   Column *headers* for the list view. Super admins (isAdmin === 2) see the
   system-level display name only; everyone else sees the brand-level
   override when one exists, and any attribute explicitly hidden for the
   list view (IS_VISIBLE_FOR_LISTVIEW === false) is dropped. Missing
   dsply_dtl rows are auto-provisioned exactly like the PHP version did.
   ========================================================================== */

async function getVisibleColumnHeaders(
  objNm: string,
  session: TableDtlSession
): Promise<string[]> {
  const attrbts = await prisma.entity_obj_attrbt.findMany({
    where: { OBJ_NM: objNm, IS_VISIBLE: true },
    orderBy: [{ OBJ_ATTRBT_SEQ: "asc" }, { OBJ_ATTRBT_ID: "asc" }],
  });
  if (attrbts.length === 0) return [];

  if (session.isAdmin === 2) {
    // getVisibleCol(): system display name only, no brand overrides.
    const sysDetails = await prisma.entity_obj_attrbt_dsply_dtl.findMany({
      where: {
        OBJ_ATTRBT_ID: { in: attrbts.map((a) => a.OBJ_ATTRBT_ID) },
        OA_BRAND_ID: null,
      },
    });
    const byId = new Map(sysDetails.map((d) => [d.OBJ_ATTRBT_ID, d]));
    return attrbts.map(
      (a) => byId.get(a.OBJ_ATTRBT_ID)?.OBJ_ATTRBT_DSPLY_NM || a.OBJ_ATTRBT_NM
    );
  }

  // getVisibleColForLV(): brand override > system default > raw column name,
  // filtered to attributes that are visible in the list view.
  const oaBrandId = session.oaBrandId ?? null;
  const [sysDetails, brandDetails] = await Promise.all([
    prisma.entity_obj_attrbt_dsply_dtl.findMany({
      where: {
        OBJ_ATTRBT_ID: { in: attrbts.map((a) => a.OBJ_ATTRBT_ID) },
        OA_BRAND_ID: null,
      },
    }),
    oaBrandId != null
      ? prisma.entity_obj_attrbt_dsply_dtl.findMany({
          where: {
            OBJ_ATTRBT_ID: { in: attrbts.map((a) => a.OBJ_ATTRBT_ID) },
            OA_BRAND_ID: Number(oaBrandId),
          },
        })
      : Promise.resolve([]),
  ]);
  const sysById = new Map(sysDetails.map((d) => [d.OBJ_ATTRBT_ID, d]));
  const brandById = new Map(brandDetails.map((d) => [d.OBJ_ATTRBT_ID, d]));

  const headers: string[] = [];
  const toProvision: DsplyDtlProvisionRow[] = [];

  for (const a of attrbts) {
    const sys = sysById.get(a.OBJ_ATTRBT_ID);
    const brand = brandById.get(a.OBJ_ATTRBT_ID);
    const listViewFlag: number | null = brand?.IS_VISIBLE_FOR_LISTVIEW ?? null;

    if (listViewFlag === 0) continue; // explicitly hidden for this brand

    const displayName =
      brand?.OBJ_ATTRBT_DSPLY_NM || sys?.OBJ_ATTRBT_DSPLY_NM || a.OBJ_ATTRBT_NM;
    headers.push(displayName);

    // Auto-provision a brand-level row the first time this attribute is
    // seen for this brand, same as the `insert_batch` at the end of the
    // legacy method.
    if (listViewFlag === null && oaBrandId != null) {
      toProvision.push({
        OBJ_ATTRBT_ID: a.OBJ_ATTRBT_ID,
        OBJ_NM: objNm,
        OBJ_ATTRBT_NM: a.OBJ_ATTRBT_NM,
        OBJ_ATTRBT_DSPLY_NM: displayName,
        IS_VISIBLE_FOR_LISTVIEW: 1,
        IS_VISIBLE_FOR_FORMVIEW: sys?.IS_VISIBLE_FOR_FORMVIEW ?? 1,
        OA_ID: session.oaId != null ? Number(session.oaId) : null,
        OA_BRAND_ID: Number(oaBrandId),
        USER_ID: session.userId != null ? Number(session.userId) : null,
      });
    }
  }

  if (toProvision.length) {
    await prisma.entity_obj_attrbt_dsply_dtl.createMany({
      data: toProvision,
      skipDuplicates: true,
    });
  }

  return headers;
}

/* ============================================================================
   2. getAllEntityObjAttrbtDtl()
   ========================================================================== */

async function getEntityObjAttrbtDisplayMap(
  objNm: string,
  session: TableDtlSession
): Promise<Record<number, string>> {
  const attrbts = await prisma.entity_obj_attrbt.findMany({
    where: { OBJ_NM: objNm },
  });
  if (attrbts.length === 0) return {};

  const oaBrandId =
    session.isAdmin === 2 ? null : session.oaBrandId != null ? Number(session.oaBrandId) : null;

  const details = await prisma.entity_obj_attrbt_dsply_dtl.findMany({
    where: {
      OBJ_ATTRBT_ID: { in: attrbts.map((a) => a.OBJ_ATTRBT_ID) },
      OA_BRAND_ID: oaBrandId,
    },
  });
  const byId = new Map(details.map((d) => [d.OBJ_ATTRBT_ID, d.OBJ_ATTRBT_DSPLY_NM]));

  const result: Record<number, string> = {};
  for (const a of attrbts) {
    result[a.OBJ_ATTRBT_ID] = byId.get(a.OBJ_ATTRBT_ID) || "";
  }
  return result;
}

/* ============================================================================
   3. getAllEntityObjAttrbt()
   ========================================================================== */

async function getSystemAttributeRows(
  objNm: string,
  session: TableDtlSession
): Promise<EntityObjAttrbtRow[]> {
  return prisma.entity_obj_attrbt.findMany({
    where: {
      OBJ_NM: objNm,
      ...(session.isAdmin !== 2 ? { IS_VISIBLE: true } : {}),
    },
    orderBy: [{ OBJ_ATTRBT_SEQ: "asc" }, { OBJ_ATTRBT_ID: "asc" }],
  }) as unknown as Promise<EntityObjAttrbtRow[]>;
}

/* ============================================================================
   4. getAllEntityObjAttrbtForLV()  /  getAllEntityObjAttrbtForFV()
   ========================================================================== */

async function getVisibilityMap(
  objNm: string,
  session: TableDtlSession,
  field: "IS_VISIBLE_FOR_LISTVIEW" | "IS_VISIBLE_FOR_FORMVIEW"
): Promise<Record<number, boolean | null>> {
  const attrbts = await prisma.entity_obj_attrbt.findMany({
    where: { OBJ_NM: objNm },
    select: { OBJ_ATTRBT_ID: true },
  });
  if (attrbts.length === 0) return {};

  const oaBrandIdNum = session.oaBrandId != null ? Number(session.oaBrandId) : NaN;
  const oaBrandId = session.isAdmin === 2 ? null : Number.isNaN(oaBrandIdNum) ? null : oaBrandIdNum;

  const details = await prisma.entity_obj_attrbt_dsply_dtl.findMany({
    where: {
      OBJ_ATTRBT_ID: { in: attrbts.map((a) => a.OBJ_ATTRBT_ID) },
      OA_BRAND_ID: oaBrandId,
    },
    select: { OBJ_ATTRBT_ID: true, [field]: true } as never,
  });

  const map: Record<number, boolean | null> = {};
  for (const d of details as unknown as Array<Record<string, boolean | null>>) {
    map[d.OBJ_ATTRBT_ID as unknown as number] = (d[field] as boolean | null) ?? null;
  }
  return map;
}

/* ============================================================================
   5. getVisibleColDtl()  ->  the actual row data ("tableBody")
   ------------------------------------------------------------------------
   `objNm` is a free-form table/view name (menu_config_vw, asset_finance_vw,
   ...), so it is not a fixed Prisma model — same situation the CI code was
   in with `$this->db->get($pvs_objNm)`. We therefore build a raw,
   *parameterised* query via `$queryRawUnsafe` + `?` placeholders instead.
   Unlike the legacy PHP (which string-concatenated `colValue` straight into
   SQL), every identifier is allow-listed and every value is a bound
   parameter — never concatenated.
   ========================================================================== */

async function getTableRows<T>(
  params: GetTableDtlParams,
  visibleColumnNames: string[]
): Promise<{ rows: T[]; total: number }> {
  const {
    objNm,
    primaryKeyColumn = "ID",
    colNm,
    colValue,
    orgColumnName,
    orgId,
    userColumnName,
    userId,
    approverColumnName,
    approverId,
    dropDownDbColumn,
    dropDownListValue,
    session,
    page,
    limit,
  } = params;

  const tableSql = ident(objNm, "table");
  const pkSql = ident(primaryKeyColumn, "primary key column");

  const selectColsSql =
    visibleColumnNames.length > 0
      ? visibleColumnNames.map((c) => ident(c, "select column")).join(", ")
      : "*";

  const whereParts: string[] = [];
  const values: unknown[] = [];

  // colNm / colValue — arbitrary extra static filters (single or paired arrays).
  if (colNm && colValue !== undefined && colValue !== null) {
    const names = Array.isArray(colNm) ? colNm : [colNm];
    const vals = Array.isArray(colValue) ? colValue : [colValue];
    names.forEach((name, i) => {
      const value = vals[i];
      if (value === "NULL") {
        whereParts.push(`${ident(name)} IS NULL`);
      } else {
        whereParts.push(`${ident(name)} = ?`);
        values.push(value);
      }
    });
  }

  // Org/brand scoping — only for org-level admins (isAdmin === 1), same as CI.
  if (session.isAdmin === 1 && orgColumnName && orgId != null) {
    whereParts.push(`${ident(orgColumnName)} = ?`);
    values.push(orgId);
  }

  // Approver scoping takes priority over the plain "my rows" filter when the
  // logged-in user IS the configured approver, matching the CI branch order.
  const isApproverMatch =
    session.isAdmin === 0 && approverId != null && String(approverId) === String(session.userId);

  if (isApproverMatch && approverColumnName) {
    whereParts.push(`${ident(approverColumnName)} = ?`);
    values.push(approverId);
  } else if (session.isAdmin === 0 && approverId == null && userColumnName && userId != null) {
    whereParts.push(`${ident(userColumnName)} = ?`);
    values.push(userId);
  }

  if (dropDownDbColumn && dropDownListValue != null) {
    whereParts.push(`${ident(dropDownDbColumn)} = ?`);
    values.push(dropDownListValue);
  }

  // Soft-delete: only applied when the table actually has an IS_DELETED column.
  const hasIsDeleted = await prisma.entity_obj_attrbt.count({
    where: { OBJ_NM: objNm, OBJ_ATTRBT_NM: "IS_DELETED" },
  });
  if (hasIsDeleted > 0) {
    whereParts.push(`${ident("IS_DELETED")} = 0`);
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

  const countRows = await prisma.$queryRawUnsafe<Array<{ total: bigint | number }>>(
    `SELECT COUNT(*) AS total FROM ${tableSql} ${whereSql}`,
    ...values
  );
  const total = Number(countRows[0]?.total ?? 0);

  const limitSql =
    page && limit
      ? `LIMIT ${Number(limit)} OFFSET ${(Math.max(Number(page), 1) - 1) * Number(limit)}`
      : "";

  const rows = await prisma.$queryRawUnsafe<T[]>(
    `SELECT ${selectColsSql} FROM ${tableSql} ${whereSql} ORDER BY ${pkSql} DESC ${limitSql}`,
    ...values
  );

  return { rows, total };
}

/* ============================================================================
   Public entry point — the direct equivalent of `getTableDtl()`
   ========================================================================== */

export async function getTableDtl<T = Record<string, unknown>>(
  params: GetTableDtlParams
): Promise<TableDtlResult<T>> {
  const { objNm, primaryKeyColumn = "ID", session, actions = [], filters = [] } = params;

  const [tableHeader, entityObjAttrbtDetails, getSystemData, visibleForLV, visibleForFV] =
    await Promise.all([
      getVisibleColumnHeaders(objNm, session),
      getEntityObjAttrbtDisplayMap(objNm, session),
      getSystemAttributeRows(objNm, session),
      getVisibilityMap(objNm, session, "IS_VISIBLE_FOR_LISTVIEW"),
      getVisibilityMap(objNm, session, "IS_VISIBLE_FOR_FORMVIEW"),
    ]);

  // Column names actually selected from the target table — visible +
  // IS_VISIBLE attributes, in sequence order (mirrors the foreach/$this->db->select loop).
  const visibleColumnNames = getSystemData
    .filter((a) => visibleForLV[a.OBJ_ATTRBT_ID] !== false)
    .map((a) => a.OBJ_ATTRBT_NM);

  const { rows: tableBody, total } = await getTableRows<T>(params, visibleColumnNames);

  const displayFields: DisplayField[] = getSystemData
    .filter((a) => visibleForLV[a.OBJ_ATTRBT_ID] !== false)
    .map((a) => ({
      accessorKey: a.OBJ_ATTRBT_NM,
      header: entityObjAttrbtDetails[a.OBJ_ATTRBT_ID] || a.OBJ_ATTRBT_NM,
      visible: true,
    }));

  const table = buildTable<T>(displayFields, filters, actions);

  return {
    objNm,
    primaryKeyColumn,
    primaryKeyValue: encodeTableDtlToken(params),
    tableHeader,
    entityObjAttrbtDetails,
    getSystemData,
    getVisibleColForLV: visibleForLV,
    getVisibleColForFV: visibleForFV,
    tableBody,
    total,
    table,
  };
}