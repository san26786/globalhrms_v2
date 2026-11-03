// Database-driven form fields — port of CI CI_Model::getColDetails($id, $table, $col, $required, 1)
// (system/core/Model.php) plus the setTextBoxControlCustom / setTextareaControlCustom /
// setDropDownControlNew / setCheckboxControl / setRadioControl choice a CI controller made per column.
//
// A module names only its entity (base table, view defaults to `<table>_vw`). Everything about each
// input comes from the entity metadata:
//   entity_obj_attrbt            — columns, order (OBJ_ATTRBT_SEQ), NOT NULL → required (as does the
//                                  save schema's 'required', CI's $required argument), size → maxLength,
//                                  OBJ_FIELD_TYPE / data type → control type
//   entity_obj_attrbt_dsply_dtl  — label and "Visible in Form": brand row first, then the system row
//                                  (OA_BRAND_ID IS NULL), then the column name ("DMN_NM" → "Dmn Nm")
// and the value comes from the record row itself.

import { prisma } from "@/lib/prisma";
import type { DynamicField, FieldRules } from "@/lib/form-builder/formTypes";

export type Row = Record<string, unknown>;

export interface EntitySpec {
  /** Base table the record is read from and saved to (CI getColDetails $table). */
  table: string;
  /** Entity object holding the labels (CI $view_name); defaults to `<table>_vw`. */
  view?: string;
  /**
   * Columns shown as inputs. Defaults to every column of the table except the primary key (its
   * first column, as CI list_fields()[0]) and the tenancy / audit columns rendered by OrgDetailsView
   * or stamped by the API.
   */
  columns?: string[];
}

export interface EntityMeta {
  table: string;
  primaryKey: string;
  /** Every column of the base table, in order. */
  allColumns: string[];
  fields: DynamicField[];
}

/** Columns every CI table carries that are never plain inputs. */
const SYSTEM_COLUMNS = new Set([
  "OA_ID", "OA_BRAND_ID", "USER_ID", "IS_DELETED",
  "CREATED_BY", "CREATED_ON", "UPDATED_BY", "UPDATED_ON",
]);

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

interface AttrRow {
  OBJ_ATTRBT_NM: string;
  OBJ_ATTRBT_DT_TYP: string;
  OBJ_ATTRBT_SEQ: number;
  IS_NULL: string;
  OBJ_SZ: number;
  OBJ_FIELD_TYPE: string | null;
}

interface DisplayRow {
  OBJ_ATTRBT_NM: string;
  SYS_DSPLY_NM: string | null;
  SYS_VISIBLE: number | null;
  BRAND_DSPLY_NM: string | null;
  BRAND_VISIBLE: number | null;
}

/** CI label fallback: "DMN_NM" → "Dmn Nm", "OA_BRAND_ID" → "Oa Brand"; display names lose a trailing " Id". */
function columnLabel(column: string): string {
  const words = column.toLowerCase().replace(/_/g, " ").replace(/(.*) \bid\b/i, "$1");
  return words.replace(/\b\w/g, (c) => c.toUpperCase());
}
const stripId = (label: string) => label.trim().replace(/(.*) id$/i, "$1");

/** OBJ_FIELD_TYPE (when set) or the column's data type → the control CI rendered. */
function controlType(a: AttrRow): string {
  switch ((a.OBJ_FIELD_TYPE ?? "").toUpperCase()) {
    case "TEXT": return "text";
    case "TEXTAREA": return "textarea";
    case "SELECT":
    case "DROPDOWN": return "select";
    case "CHECKBOX": return "checkbox";
    case "RADIO": return "radio";
    case "DATE": return "date";
    case "NUMBER": return "number";
  }
  const dt = a.OBJ_ATTRBT_DT_TYP.toLowerCase();
  if (dt === "text" || dt === "mediumtext" || dt === "longtext") return "textarea";
  if (dt === "date") return "date";
  if (dt === "datetime" || dt === "timestamp") return "datetime";
  if (dt === "time") return "time";
  if (dt === "tinyint" && a.OBJ_SZ <= 1) return "checkbox";
  if (["int", "bigint", "smallint", "tinyint", "decimal", "double", "float"].includes(dt)) return "number";
  return "text";
}

async function loadAttributes(objNm: string): Promise<AttrRow[]> {
  return prisma.entity_obj_attrbt.findMany({
    where: { OBJ_NM: objNm, IS_DELETED: 0 },
    select: {
      OBJ_ATTRBT_NM: true, OBJ_ATTRBT_DT_TYP: true, OBJ_ATTRBT_SEQ: true,
      IS_NULL: true, OBJ_SZ: true, OBJ_FIELD_TYPE: true,
    },
    orderBy: { OBJ_ATTRBT_SEQ: "asc" },
  });
}

/** CI getColDetails' entity query: system (OA_BRAND_ID IS NULL) and brand display rows per column. */
async function loadDisplay(view: string, oaBrandId: number | null): Promise<Map<string, DisplayRow>> {
  const rows = await prisma.$queryRawUnsafe<DisplayRow[]>(
    `SELECT eoa."OBJ_ATTRBT_NM",
            sys."OBJ_ATTRBT_DSPLY_NM" AS "SYS_DSPLY_NM", sys."IS_VISIBLE_FOR_FORMVIEW" AS "SYS_VISIBLE",
            brd."OBJ_ATTRBT_DSPLY_NM" AS "BRAND_DSPLY_NM", brd."IS_VISIBLE_FOR_FORMVIEW" AS "BRAND_VISIBLE"
       FROM entity_obj_attrbt eoa
       LEFT JOIN LATERAL (SELECT d."OBJ_ATTRBT_DSPLY_NM", d."IS_VISIBLE_FOR_FORMVIEW" FROM entity_obj_attrbt_dsply_dtl d
                           WHERE d."OBJ_ATTRBT_ID" = eoa."OBJ_ATTRBT_ID" AND d."OA_BRAND_ID" IS NULL AND d."IS_DELETED" = 0
                           ORDER BY d."OBJ_ATTRBT_DSPLY_ID" LIMIT 1) sys ON TRUE
       LEFT JOIN LATERAL (SELECT d."OBJ_ATTRBT_DSPLY_NM", d."IS_VISIBLE_FOR_FORMVIEW" FROM entity_obj_attrbt_dsply_dtl d
                           WHERE d."OBJ_ATTRBT_ID" = eoa."OBJ_ATTRBT_ID" AND d."OA_BRAND_ID" = $2 AND d."IS_DELETED" = 0
                           ORDER BY d."OBJ_ATTRBT_DSPLY_ID" LIMIT 1) brd ON TRUE
      WHERE eoa."OBJ_NM" = $1 AND eoa."IS_DELETED" = 0`,
    view,
    oaBrandId ?? -1,
  );
  return new Map(rows.map((r) => [r.OBJ_ATTRBT_NM.toLowerCase(), r]));
}

/**
 * CI getColDetails detail flag: label from the brand row, else the system row, else the column
 * name; the input is hidden when that row has "Visible in Form" off — unless it is required.
 */
function display(column: string, required: boolean, d: DisplayRow | undefined) {
  const label = d?.BRAND_DSPLY_NM || d?.SYS_DSPLY_NM;
  const visibleFlag = d?.BRAND_DSPLY_NM ? d.BRAND_VISIBLE : d?.SYS_DSPLY_NM ? d.SYS_VISIBLE : 1;
  return {
    label: label ? stripId(label) : columnLabel(column),
    hidden: !required && Number(visibleFlag) !== 1,
  };
}

/**
 * The form fields of an entity for the caller's brand (the system administrator sees the system
 * labels, as in CI where his brand id is null).
 */
export async function entityFields(
  spec: EntitySpec,
  oaBrandId: number | null,
  isRequired: (column: string) => boolean = () => false,
): Promise<EntityMeta> {
  if (!IDENT.test(spec.table)) throw new Error(`Invalid entity table "${spec.table}".`);
  const view = spec.view ?? `${spec.table}_vw`;

  const [attrs, displayMap] = await Promise.all([loadAttributes(spec.table), loadDisplay(view, oaBrandId)]);
  if (!attrs.length) throw new Error(`No entity metadata for "${spec.table}".`);

  const primaryKey = attrs[0].OBJ_ATTRBT_NM;
  const byName = new Map(attrs.map((a) => [a.OBJ_ATTRBT_NM, a]));
  const columns = spec.columns ?? attrs
    .map((a) => a.OBJ_ATTRBT_NM)
    .filter((c) => c !== primaryKey && !SYSTEM_COLUMNS.has(c));

  const fields = columns.flatMap((column, order): DynamicField[] => {
    const a = byName.get(column);
    if (!a) return [];
    const required = a.IS_NULL.toUpperCase() === "NO" || isRequired(column);
    const type = controlType(a);
    const rules: FieldRules | undefined =
      (type === "text" || type === "textarea") && a.OBJ_SZ > 0 ? { maxLength: a.OBJ_SZ } : undefined;
    return [{
      name: column,
      id: column,
      attribute: column,
      type,
      required,
      order,
      ...display(column, required, displayMap.get(column.toLowerCase())),
      ...(rules ? { rules } : {}),
    }];
  });

  return { table: spec.table, primaryKey, allColumns: attrs.map((a) => a.OBJ_ATTRBT_NM), fields };
}

/** CI getColDetails' value: the record's columns read straight from the base table. */
export async function entityRow(meta: EntityMeta, id: number): Promise<Row | null> {
  const cols = meta.allColumns.filter((c) => IDENT.test(c)).map((c) => `"${c}"`).join(", ");
  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT ${cols} FROM "${meta.table}" WHERE "${meta.primaryKey}" = $1 LIMIT 1`,
    id,
  );
  return rows[0] ?? null;
}

/** The part of the session OrgDetailsView and the label lookup need. */
export interface EntitySubject {
  adminLevel: number;
  oaBrandId: number | null;
}

/**
 * CI OrgDetailsView (formview_v, every form of a table with OA_ID / OA_BRAND_ID): only the system
 * administrator sees it — Organisation, then Brand filtered by it (changeOrgBrand) when adding; the
 * record's organisation and brand, read-only, when editing (the API never moves a record to another
 * brand). Everyone else is stamped with the session organisation / brand by the API.
 */
async function orgDetails(meta: EntityMeta, subject: EntitySubject, row: Row | null) {
  const hasOrg = meta.allColumns.includes("OA_ID") && meta.allColumns.includes("OA_BRAND_ID");
  if (!hasOrg || subject.adminLevel !== 2) return { fields: [] as DynamicField[], values: {} as Row };

  if (!row) {
    const organisations = await prisma.org_accounts.findMany({
      where: { IS_DELETED: 0 },
      select: { OA_ID: true, OA_NM: true },
      orderBy: [{ OA_NM: "asc" }, { OA_ID: "asc" }],
    });
    return {
      fields: [
        { name: "oaId", label: "Organisation", type: "select", required: true,
          options: organisations.map((o) => ({ value: o.OA_ID, label: o.OA_NM })) },
        { name: "oaBrandId", label: "Brand", type: "select", required: true,
          optionsUrl: "/api/lookups/brands?oaId={oaId}" },
      ] as DynamicField[],
      values: {},
    };
  }

  const [org, brand] = await Promise.all([
    prisma.org_accounts.findFirst({ where: { OA_ID: Number(row.OA_ID) }, select: { OA_NM: true } }),
    prisma.oa_brands.findFirst({ where: { OA_BRAND_ID: Number(row.OA_BRAND_ID) }, select: { OA_BRAND_NM: true } }),
  ]);
  return {
    fields: [
      { name: "organisation", label: "Organisation", type: "text", readOnly: true },
      { name: "brandName", label: "Brand", type: "text", readOnly: true },
    ] as DynamicField[],
    values: { organisation: org?.OA_NM ?? "", brandName: brand?.OA_BRAND_NM ?? "" },
  };
}

/**
 * Fields and values of an entity form: the DB-driven column inputs followed by OrgDetailsView.
 * `id` is the record being edited (already authorised by the caller), null when adding.
 */
export async function entityForm(
  spec: EntitySpec,
  subject: EntitySubject,
  id: number | null,
  isRequired?: (column: string) => boolean,
) {
  const meta = await entityFields(spec, subject.adminLevel === 2 ? null : subject.oaBrandId, isRequired);
  const row = id ? await entityRow(meta, id) : null;
  const org = await orgDetails(meta, subject, row);

  const values: Row = { ...org.values };
  if (row) for (const f of meta.fields) values[f.name] = row[f.name] ?? (f.type === "checkbox" ? false : "");
  return { fields: [...meta.fields, ...org.fields], values };
}
