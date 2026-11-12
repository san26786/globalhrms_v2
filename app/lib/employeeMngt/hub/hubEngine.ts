import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { readStored, storeUpload, type AttachmentStore } from '@/lib/files/attachmentStore';
import { BusinessRuleError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { parseListQuery } from '@/lib/resource/listQuery';
import { menuPolicy } from '@/lib/resource/policies';
import type { ListResult, ResourcePermissions } from '@/lib/resource/types';
import { brandOrgId, parseId, type IdLabel } from '@/lib/systmMngt/shared';
import { SqlBuilder, ownEmployeeId } from '../empList';
import { fieldIsHidden, fieldIsRequired, type HubFieldDef, type HubScreenDefs } from './hubFields';
import { HUB_SCREENS, type HubFormModel, type HubScreenKey, type HubValues } from './hubTypes';

/**
 * The CI employee sub-record screens (Education, Licences, …) all follow one pattern: listview_v over a
 * view of the record table joined to its employee, scoped by CI getTableDtl (super admin: every brand;
 * brand admin: the brand; user: their own employee's records), and formview_v to add / edit one record
 * for an employee (a normal user: always themself). This engine runs that pattern from a per-screen
 * config (screens/*.ts): the list columns are SQL over the base tables (the CI views do not exist in
 * PostgreSQL), writes are cast to each column's real type, and screens with extra tables plug in hooks.
 */

export type Tx = Prisma.TransactionClient;
export type DbValue = string | number | boolean | null;

export interface EmployeeRef {
  id: number;
  brand: number;
  oaId: number | null;
  /** The employee's login user (emp_mst.REF_EMP_ID). */
  userId: number | null;
  code: string | null;
  name: string;
}

/** Dropdown choices; `parent` ties an option to the value of the field it depends on. */
export type HubOptionList = Array<{ value: number | string; label: string; parent?: number }>;

export interface EmployeeOptions {
  options: Record<string, HubOptionList>;
  /** Per-option data by list name and option value (e.g. a relative's name and birth date). */
  extras: Record<string, Record<string, Record<string, unknown>>>;
}

export interface HubContext {
  subject: RequestSubject;
  employee: EmployeeRef;
  /** Record id on edit, null on add. */
  id: number | null;
  /** The stored record (t.*) on edit. */
  row: Record<string, unknown> | null;
  /** The stored values on edit. */
  existing: HubValues | null;
  options: Record<string, HubOptionList>;
  flags: Record<string, boolean>;
}

export interface HubConfig {
  key: HubScreenKey;
  defs: HubScreenDefs;
  table: string;
  pk: string;
  /** Column of `table` holding the employee (generic writes); null when the record links through other tables. */
  empColumn: string | null;
  /** FROM clause yielding the record as `t` and its employee as `em` (default: joined on empColumn). */
  from?: string;
  /** Condition on t for live rows (e.g. not soft-deleted). */
  alive?: string;
  /** Extra SELECT list for the list (aliases are the row keys). id / EMPLOYEE_ID / EMP_NBR / EMP_FULL_NAME / OA_BRAND_CD are added. */
  listColumns: string;
  /** Row keys searched with ILIKE. */
  search: string[];
  /** Sortable row keys. */
  sorts: string[];
  /** Default ORDER BY on the row keys (alias v), when the user has not sorted; default newest first. */
  defaultSort?: string;
  /** Form field → table column, for the generic read / write. */
  bind: Record<string, string>;
  /** 'soft' sets IS_DELETED = 1. */
  deleteMode: 'hard' | 'soft';
  messages: { created: string; updated: string; deleted: string };
  /** Dropdown lists; `row` is the record being edited (to keep its current choice in the list), null on add. */
  options?: (subject: RequestSubject, brand: number | null, row: Record<string, unknown> | null) => Promise<Record<string, HubOptionList>>;
  flags?: (brand: number | null) => Promise<Record<string, boolean>>;
  /**
   * Dropdowns that depend on the chosen employee (their relatives…) and per-option data the form uses to
   * prefill fields (GET /api/employeeMngt/[screen]/employee-options).
   */
  employeeOptions?: (employee: EmployeeRef, row: Record<string, unknown> | null) => Promise<EmployeeOptions>;
  /** Stored row → form values for fields that are not simple bindings. */
  read?: (row: Record<string, unknown>, values: HubValues) => Promise<void> | void;
  validate?: (values: HubValues, check: Checks, ctx: HubContext) => Promise<void> | void;
  /** Columns written besides the bindings (insert and update). */
  extraColumns?: (values: HubValues, ctx: HubContext) => Promise<Record<string, DbValue>> | Record<string, DbValue>;
  /** Custom writes for screens whose record spans several tables (replace the generic insert / update / delete). */
  insert?: (tx: Tx, values: HubValues, ctx: HubContext) => Promise<number>;
  update?: (tx: Tx, values: HubValues, ctx: HubContext) => Promise<void>;
  remove?: (tx: Tx, ctx: HubContext) => Promise<void>;
  /** After the generic insert / update (same transaction). */
  afterWrite?: (tx: Tx, id: number, values: HubValues, ctx: HubContext) => Promise<void>;
  /** One uploaded file per record (uploaded / downloaded through /api/employeeMngt/[screen]/[id]/file). */
  attachment?: {
    column: string;
    store: AttachmentStore;
    /** Start of the stored name (default "{record id}_"). */
    prefix?: (id: number, employee: EmployeeRef) => Promise<string> | string;
    /** Checks the upload (throw a ValidationError) and returns columns to save with it (e.g. a picture's size). */
    inspect?: (file: File, bytes: Buffer) => Record<string, DbValue>;
    /** The content type to show the file inline with (an image whose bytes match), else it downloads. */
    inline?: (bytes: Buffer) => string | null;
    /** The file is the record: it cannot be detached. */
    required?: boolean;
  };
  /** CI let only admins (is_admin ≠ 0) add, edit and delete, whatever the menu grant said. */
  adminOnlyWrites?: boolean;
  /** A worklist: records are added elsewhere. */
  noCreate?: boolean;
  /** Initial values of the add form. */
  defaults?: (subject: RequestSubject, brand: number | null) => Promise<HubValues>;
  /** The list's own filters (CI customFields: month / year pickers): a condition on the row keys (alias v), or null. */
  listFilter?: (rawQuery: Record<string, string>, sql: SqlBuilder) => string | null;
}

// ------------------------------------------------------------------ validation helper

export class Checks {
  readonly errors: Record<string, string[]> = {};
  fail(field: string, message: string): void {
    this.errors[field] ??= [message];
  }
  has(field: string): boolean {
    return !!this.errors[field];
  }
  throwIfAny(): void {
    if (Object.keys(this.errors).length) throw new ValidationError('Validation failed.', this.errors);
  }
}

export const isDate = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);
export const today = () => new Date().toISOString().slice(0, 10);
export const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());

// ------------------------------------------------------------------ column catalogue / typed writes

interface ColumnMeta {
  name: string;
  type: string;
  nullable: boolean;
}

const catalogue = new Map<string, Map<string, ColumnMeta>>();

/** The table's columns, keyed by upper-cased name (CI tables mix "CREATED_ON" / "Created_On"). */
export async function columnsOf(table: string): Promise<Map<string, ColumnMeta>> {
  const cached = catalogue.get(table);
  if (cached) return cached;
  const rows = await prisma.$queryRaw<Array<{ name: string; type: string; nullable: string }>>`
    SELECT column_name AS name, data_type AS type, is_nullable AS nullable
    FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${table}`;
  const map = new Map(rows.map((r) => [r.name.toUpperCase(), { name: r.name, type: r.type, nullable: r.nullable === 'YES' }]));
  catalogue.set(table, map);
  return map;
}

const NUMERIC = ['integer', 'smallint', 'bigint', 'numeric', 'double precision', 'real'];
const castOf = (meta: ColumnMeta) => (['USER-DEFINED', 'ARRAY'].includes(meta.type) ? 'text' : meta.type);

/** A value in the form the column stores it (CI's MySQL turned NULL into '' / 0 for NOT NULL columns). */
function forColumn(meta: ColumnMeta, value: DbValue): string | null {
  const numeric = NUMERIC.includes(meta.type);
  if (typeof value === 'boolean') {
    if (meta.type === 'boolean') return value ? 'true' : 'false';
    return value ? '1' : '0';
  }
  const raw = value === null ? '' : String(value).trim();
  if (raw === '') {
    if (meta.nullable) return null;
    if (numeric) return '0';
    if (meta.type === 'boolean') return 'false';
    if (meta.type.startsWith('date') || meta.type.startsWith('timestamp')) return null;
    return '';
  }
  if (numeric && !/^-?\d+(\.\d+)?$/.test(raw)) return meta.nullable ? null : '0';
  return raw;
}

const AUDIT_NOW = (meta: ColumnMeta) => `to_char(now(), 'YYYY-MM-DD HH24:MI:SS')::${castOf(meta)}`;

/**
 * `"COL" = $n::type` pairs for the columns the table has (unknown names are skipped); `stamps` are
 * timestamp columns set to now — the first spelling the table has (CI tables use CREATED_ON or CREATEDON).
 */
async function bind(table: string, data: Record<string, DbValue>, stamps: string[][], params: unknown[]) {
  const columns = await columnsOf(table);
  const out: Array<{ column: string; value: string }> = [];
  for (const [name, value] of Object.entries(data)) {
    const meta = columns.get(name.toUpperCase());
    if (!meta) continue;
    params.push(forColumn(meta, value));
    out.push({ column: `"${meta.name}"`, value: `$${params.length}::${castOf(meta)}` });
  }
  for (const spellings of stamps) {
    const meta = spellings.map((s) => columns.get(s)).find(Boolean);
    if (meta) out.push({ column: `"${meta.name}"`, value: AUDIT_NOW(meta) });
  }
  return out;
}

const CREATED_STAMP = [['CREATED_ON', 'CREATEDON']];
const UPDATED_STAMP = [['UPDATED_ON', 'UPDATEDON']];

export async function insertRow(tx: Tx, table: string, pk: string, data: Record<string, DbValue>, actorId: number): Promise<number> {
  await assertInsertSafe(table, pk);
  const params: unknown[] = [];
  const columns = await columnsOf(table);
  const withAudit: Record<string, DbValue> = { ...data, CREATED_BY: actorId };
  if (columns.has('IS_DELETED') && !(Object.keys(data).some((k) => k.toUpperCase() === 'IS_DELETED'))) withAudit.IS_DELETED = 0;
  if (columns.get('UPDATED_BY')?.nullable === false) withAudit.UPDATED_BY = actorId;
  // Some migrated tables declare UPDATED_ON NOT NULL without a default (CI's MySQL filled a zero date).
  const updated = UPDATED_STAMP[0].map((s) => columns.get(s)).find(Boolean);
  const stamps = updated && !updated.nullable ? [...CREATED_STAMP, ...UPDATED_STAMP] : CREATED_STAMP;
  const pairs = await bind(table, withAudit, stamps, params);
  const [row] = await tx.$queryRawUnsafe<Array<{ id: number }>>(
    `INSERT INTO ${table} (${pairs.map((p) => p.column).join(', ')}) VALUES (${pairs.map((p) => p.value).join(', ')}) RETURNING "${pk}" AS id`,
    ...params,
  );
  return Number(row.id);
}

export async function updateRow(tx: Tx, table: string, pk: string, id: number, data: Record<string, DbValue>, actorId: number): Promise<void> {
  const params: unknown[] = [];
  const pairs = await bind(table, { ...data, UPDATED_BY: actorId }, UPDATED_STAMP, params);
  params.push(id);
  await tx.$executeRawUnsafe(
    `UPDATE ${table} SET ${pairs.map((p) => `${p.column} = ${p.value}`).join(', ')} WHERE "${pk}" = $${params.length}::integer`,
    ...params,
  );
}

export async function softDeleteRow(tx: Tx, table: string, pk: string, id: number, actorId: number): Promise<void> {
  await updateRow(tx, table, pk, id, { IS_DELETED: 1 }, actorId);
}

// ------------------------------------------------------------------ SQL fragments

export const fullName = (alias: string) =>
  `btrim(regexp_replace(COALESCE(${alias}."EMP_NAME", '') || ' ' || COALESCE(${alias}."EMP_MIDDLE_NM", '') || ' ' || COALESCE(${alias}."EMPLST_NM", ''), '\\s+', ' ', 'g'))`;
/** Text column holding an id → the id, or NULL when it holds anything else. */
export const asId = (expr: string) => `CASE WHEN (${expr})::text ~ '^\\s*-?[0-9]+\\s*$' THEN btrim((${expr})::text)::bigint END`;
export const masterName = (expr: string) => `(SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = ${asId(expr)} LIMIT 1)`;
export const isoDate = (expr: string) => `to_char(${expr}, 'YYYY-MM-DD')`;

const COMMON_COLUMNS = `em."EMP_ID" AS "EMPLOYEE_ID", em."EMP_NBR", ${fullName('em')} AS "EMP_FULL_NAME", em."OA_BRAND_ID" AS "BRAND_ID",
  (SELECT b."OA_BRAND_CD" FROM oa_brands b WHERE b."OA_BRAND_ID" = em."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_CD"`;

const fromOf = (cfg: HubConfig) => cfg.from ?? `${cfg.table} t JOIN emp_mst em ON em."EMP_ID" = t."${cfg.empColumn}"`;
const aliveOf = (cfg: HubConfig) => cfg.alive ?? 'TRUE';

/** CI getTableDtl scoping, on the record's employee. */
export async function scopeSql(subject: RequestSubject, sql: SqlBuilder): Promise<string> {
  if (subject.adminLevel === 2) return 'TRUE';
  if (subject.adminLevel === 1) return `em."OA_BRAND_ID" = ${sql.p(subject.oaBrandId ?? -1)}`;
  const own = await ownEmployeeId(subject);
  return own ? `em."EMP_ID" = ${sql.p(own)}` : 'FALSE';
}

/** JSON-friendly row: dates as YYYY-MM-DD, decimals / bigints as numbers or strings. */
function plain(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Date) out[k] = v.toISOString().slice(0, 10);
    else if (typeof v === 'bigint') out[k] = Number(v);
    else if (v !== null && typeof v === 'object' && 'toFixed' in v) out[k] = String(v);
    else out[k] = v;
  }
  return out;
}

// ------------------------------------------------------------------ employees

async function employeeById(id: number): Promise<EmployeeRef | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: number; brand: number; oa: number | null; user: number | null; code: string | null; name: string }>>(
    `SELECT em."EMP_ID" AS id, em."OA_BRAND_ID" AS brand, em."OA_ID" AS oa, em."REF_EMP_ID" AS "user", em."EMP_NBR" AS code, ${fullName('em')} AS name
     FROM emp_mst em WHERE em."EMP_ID" = $1::integer AND em."IS_DELETED" = 0 LIMIT 1`,
    id,
  );
  const r = rows[0];
  if (!r) return null;
  const brand = Number(r.brand);
  return { id: Number(r.id), brand, oaId: r.oa ? Number(r.oa) : await brandOrgId(brand, null), userId: r.user ? Number(r.user) : null, code: r.code, name: r.name };
}

/** The employee a record is for: a normal user → themself; an admin → the posted one, if in their scope. */
async function resolveEmployee(subject: RequestSubject, posted: string, check: Checks): Promise<EmployeeRef | null> {
  if (subject.adminLevel === 0) {
    const own = await ownEmployeeId(subject);
    if (!own) throw new BusinessRuleError('You do not have an employee record in this brand.', 'NO_EMPLOYEE_RECORD');
    return employeeById(own);
  }
  const id = Number(posted);
  if (!posted || !Number.isInteger(id) || id <= 0) {
    check.fail('EMP_ID', 'The Employee field is required.');
    return null;
  }
  const employee = await employeeById(id);
  if (!employee || (subject.adminLevel === 1 && employee.brand !== subject.oaBrandId)) {
    check.fail('EMP_ID', 'Select a valid Employee.');
    return null;
  }
  return employee;
}

/** CI getAllEmployeeMst(): the brand's employees (super admin without a brand: every brand). */
async function employeeOptions(subject: RequestSubject): Promise<IdLabel[]> {
  if (subject.adminLevel === 0) {
    const own = await ownEmployeeId(subject);
    const me = own ? await employeeById(own) : null;
    return me ? [{ value: me.id, label: me.code ? `${me.name} (${me.code})` : me.name }] : [];
  }
  const brand = subject.adminLevel === 2 && !subject.oaBrandId ? null : (subject.oaBrandId ?? -1);
  const rows = await prisma.$queryRawUnsafe<Array<{ value: number; label: string; code: string | null }>>(
    `SELECT em."EMP_ID" AS value, ${fullName('em')} AS label, em."EMP_NBR" AS code FROM emp_mst em
     WHERE em."IS_DELETED" = 0 AND ($1::int IS NULL OR em."OA_BRAND_ID" = $1::int)
     ORDER BY label, em."EMP_ID"`,
    brand,
  );
  return rows.map((r) => {
    const name = r.label || `Employee #${r.value}`;
    return { value: Number(r.value), label: r.code ? `${name} (${r.code})` : name };
  });
}

// ------------------------------------------------------------------ values

const bodySchema = z.record(z.string(), z.unknown());

/** Posted body → trimmed strings / booleans for the screen's fields (+ EMP_ID). */
function parseBody(cfg: HubConfig, body: unknown): HubValues {
  const raw = bodySchema.parse(body ?? {});
  const values: HubValues = { EMP_ID: str(raw.EMP_ID) };
  for (const f of cfg.defs.fields) {
    if (f.type === 'file') continue; // uploaded separately (multipart)
    const v = raw[f.name];
    values[f.name] = f.type === 'checkbox' ? v === true || v === 1 || v === '1' || v === 'true' : str(v).slice(0, 4000);
  }
  return values;
}

/** Stored value → form value. */
export function toFormValue(field: HubFieldDef, v: unknown): string | boolean {
  if (field.type === 'checkbox') return ['1', 'y', 'yes', 'true'].includes(str(v).toLowerCase());
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (field.type === 'date') {
    const s = str(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const dmy = /^(\d{2})[-./](\d{2})[-./](\d{4})$/.exec(s);
    return dmy ? `${dmy[3]}-${dmy[2]}-${dmy[1]}` : '';
  }
  if (field.type === 'select') return v === null || v === undefined || str(v) === '0' ? '' : str(v);
  return str(v);
}

async function readValues(cfg: HubConfig, row: Record<string, unknown>): Promise<HubValues> {
  const values: HubValues = { EMP_ID: String(row.__EMP_ID) };
  const byUpper = new Map(Object.keys(row).map((k) => [k.toUpperCase(), k]));
  for (const f of cfg.defs.fields) {
    if (f.type === 'file') continue;
    const column = cfg.bind[f.name];
    const key = column ? byUpper.get(column.toUpperCase()) : undefined;
    values[f.name] = key ? toFormValue(f, row[key]) : f.type === 'checkbox' ? false : '';
  }
  if (cfg.attachment) {
    const key = byUpper.get(cfg.attachment.column.toUpperCase());
    const raw = key ? row[key] : null;
    // A bytea column (emp_picture) holds the name's bytes.
    values.attachmentName = raw instanceof Uint8Array ? Buffer.from(raw).toString('utf8') : str(raw);
  }
  await cfg.read?.(row, values);
  return values;
}

/**
 * Generic rules from the field definitions. A value the record already holds is not re-checked (CI's
 * migrated data predates some rules, and a select's stored choice may have left its list).
 */
function genericChecks(cfg: HubConfig, values: HubValues, check: Checks, ctx: HubContext): void {
  for (const f of cfg.defs.fields) {
    if (f.type === 'file' || fieldIsHidden(f, values, ctx.flags)) continue;
    const v = values[f.name];
    if (typeof v === 'boolean') continue;
    if (!v) {
      if (fieldIsRequired(f, values, ctx.flags)) check.fail(f.name, `The ${f.label} field is required.`);
      continue;
    }
    if (ctx.existing && v === ctx.existing[f.name]) continue;
    if (f.type === 'date' && !isDate(v)) check.fail(f.name, `The ${f.label} field must be a valid date.`);
    if (f.type === 'number' && !/^\d+(\.\d+)?$/.test(v)) check.fail(f.name, `The ${f.label} field must contain a positive number.`);
    if (f.type === 'email' && !z.email().safeParse(v).success) check.fail(f.name, `The ${f.label} field must contain a valid email address.`);
    if (f.max && f.type !== 'number' && v.length > f.max) check.fail(f.name, `The ${f.label} field cannot exceed ${f.max} characters in length.`);
    if (f.max && f.type === 'number' && v.split('.')[0].length > f.max) check.fail(f.name, `The ${f.label} field is too large.`);
    if (f.type === 'select' && f.options) {
      const list = ctx.options[f.options] ?? [];
      const parent = f.dependsOn ? String(values[f.dependsOn] ?? '') : null;
      if (!list.some((o) => String(o.value) === v && (parent === null || String(o.parent ?? '') === parent))) {
        check.fail(f.name, `Select a valid ${f.label}.`);
      }
    }
  }
}

function boundColumns(cfg: HubConfig, values: HubValues, ctx: HubContext): Record<string, DbValue> {
  const data: Record<string, DbValue> = {};
  for (const f of cfg.defs.fields) {
    const column = cfg.bind[f.name];
    if (!column || f.type === 'file') continue;
    // Hidden fields are cleared (CI posted nothing for them).
    data[column] = fieldIsHidden(f, values, ctx.flags) ? (f.type === 'checkbox' ? false : null) : values[f.name];
  }
  return data;
}

function ownershipColumns(cfg: HubConfig, employee: EmployeeRef): Record<string, DbValue> {
  const data: Record<string, DbValue> = { OA_ID: employee.oaId, OA_BRAND_ID: employee.brand };
  if (employee.userId) data.USER_ID = employee.userId;
  if (cfg.empColumn) data[cfg.empColumn] = employee.id;
  return data;
}

// ------------------------------------------------------------------ service

/** The menu grant, narrowed by the screen's own rules (admin-only writes, worklists without add). */
async function allowed(subject: RequestSubject, cfg: HubConfig, action: 'list' | 'create' | 'update' | 'delete'): Promise<boolean> {
  if (action !== 'list' && cfg.adminOnlyWrites && subject.adminLevel === 0) return false;
  if (action === 'create' && cfg.noCreate) return false;
  return menuPolicy(HUB_SCREENS[cfg.key].menu).check(subject, action);
}

async function permissions(subject: RequestSubject, cfg: HubConfig): Promise<ResourcePermissions> {
  const [create, update, del] = await Promise.all([allowed(subject, cfg, 'create'), allowed(subject, cfg, 'update'), allowed(subject, cfg, 'delete')]);
  return { create, update, delete: del };
}

async function requireGrant(subject: RequestSubject, cfg: HubConfig, action: 'list' | 'create' | 'update' | 'delete') {
  if (!(await allowed(subject, cfg, action))) throw new ForbiddenError();
}

/** The record (t.* plus __EMP_ID) if it is in the caller's scope. */
async function findRow(subject: RequestSubject, cfg: HubConfig, id: number): Promise<Record<string, unknown>> {
  const sql = new SqlBuilder();
  const scope = await scopeSql(subject, sql);
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT t.*, em."EMP_ID" AS "__EMP_ID" FROM ${fromOf(cfg)}
     WHERE t."${cfg.pk}" = ${sql.p(id)}::integer AND ${aliveOf(cfg)} AND em."IS_DELETED" = 0 AND ${scope} LIMIT 1`,
    ...sql.params,
  );
  if (!rows[0]) throw new NotFoundError('Record not found.');
  return rows[0];
}

async function contextFor(subject: RequestSubject, cfg: HubConfig, employee: EmployeeRef, id: number | null, row: Record<string, unknown> | null, existing: HubValues | null): Promise<HubContext> {
  const [options, flags, perEmployee] = await Promise.all([
    cfg.options ? cfg.options(subject, employee.brand, row) : Promise.resolve({}),
    cfg.flags ? cfg.flags(employee.brand) : Promise.resolve({}),
    cfg.employeeOptions ? cfg.employeeOptions(employee, row) : Promise.resolve({ options: {}, extras: {} }),
  ]);
  return { subject, employee, id, row, existing, options: { ...options, ...perEmployee.options }, flags };
}

export function hubService(cfg: HubConfig) {
  return {
    /** What the caller may do on the screen (its sub-resources use it too). */
    permissions: (subject: RequestSubject) => permissions(subject, cfg),

    async list(subject: RequestSubject, rawQuery: Record<string, string>): Promise<ListResult<Record<string, unknown>> & { permissions: ResourcePermissions }> {
      await requireGrant(subject, cfg, 'list');
      const query = parseListQuery(rawQuery);
      const sql = new SqlBuilder();
      const scope = await scopeSql(subject, sql);
      const emp = Number(rawQuery.emp);
      const empFilter = Number.isInteger(emp) && emp > 0 ? `AND em."EMP_ID" = ${sql.p(emp)}::integer` : '';
      const filters: string[] = [];
      const own = cfg.listFilter?.(rawQuery, sql);
      if (own) filters.push(own);
      if (query.search) {
        const term = sql.p(`%${query.search}%`);
        filters.push(`(${['EMP_NBR', 'EMP_FULL_NAME', ...cfg.search].map((c) => `v."${c}"::text ILIKE ${term}`).join(' OR ')})`);
      }
      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
      const sortable = ['EMP_NBR', 'EMP_FULL_NAME', 'OA_BRAND_CD', ...cfg.sorts];
      const sort = query.sort && sortable.includes(query.sort)
        ? `v."${query.sort}" ${query.dir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST, v.id DESC`
        : (cfg.defaultSort ?? 'v.id DESC');
      const from = `(SELECT t."${cfg.pk}" AS id, ${COMMON_COLUMNS}, ${cfg.listColumns}
        FROM ${fromOf(cfg)} WHERE ${aliveOf(cfg)} AND em."IS_DELETED" = 0 AND ${scope} ${empFilter}) v ${where}`;
      const [rows, count, perms] = await Promise.all([
        prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
          `SELECT * FROM ${from} ORDER BY ${sort} LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`,
          ...sql.params,
        ),
        prisma.$queryRawUnsafe<Array<{ n: number }>>(`SELECT count(*)::int AS n FROM ${from}`, ...sql.params),
        permissions(subject, cfg),
      ]);
      return { rows: rows.map((r) => ({ ...plain(r), id: Number(r.id) })), total: count[0]?.n ?? 0, page: query.page, limit: query.limit, permissions: perms };
    },

    /** CI initForm dropdowns: the employees the caller may pick and the screen's lists (`rawId`: the record being edited). */
    async form(subject: RequestSubject, rawId?: string): Promise<HubFormModel> {
      await requireGrant(subject, cfg, 'list');
      const row = rawId ? await findRow(subject, cfg, parseId(rawId)) : null;
      const brand = row ? Number((await employeeById(Number(row.__EMP_ID)))?.brand ?? subject.oaBrandId) : (subject.oaBrandId ?? null);
      const [employees, own, options, flags, defaults] = await Promise.all([
        employeeOptions(subject),
        ownEmployeeId(subject),
        cfg.options ? cfg.options(subject, brand, row) : Promise.resolve({}),
        cfg.flags ? cfg.flags(brand) : Promise.resolve({}),
        cfg.defaults && !row ? cfg.defaults(subject, brand) : Promise.resolve({}),
      ]);
      return { employees, ownEmployeeId: own, options, flags, defaults, restricted: subject.adminLevel === 0 };
    },

    /** The dropdowns of the chosen employee (`rawEmp`), or of the record being edited (`rawId`). */
    async employeeForm(subject: RequestSubject, rawEmp: string, rawId?: string): Promise<EmployeeOptions> {
      await requireGrant(subject, cfg, 'list');
      if (!cfg.employeeOptions) return { options: {}, extras: {} };
      const row = rawId ? await findRow(subject, cfg, parseId(rawId)) : null;
      const employee = row
        ? await employeeById(Number(row.__EMP_ID))
        : await resolveEmployee(subject, rawEmp, new Checks()).catch(() => null);
      return employee ? cfg.employeeOptions(employee, row) : { options: {}, extras: {} };
    },

    async get(subject: RequestSubject, rawId: string): Promise<HubValues> {
      await requireGrant(subject, cfg, 'list');
      return readValues(cfg, await findRow(subject, cfg, parseId(rawId)));
    },

    async create(subject: RequestSubject, body: unknown): Promise<{ id: number; message: string }> {
      await requireGrant(subject, cfg, 'create');
      const values = parseBody(cfg, body);
      const check = new Checks();
      const employee = await resolveEmployee(subject, String(values.EMP_ID), check);
      if (!employee) {
        check.throwIfAny();
        throw new NotFoundError('Employee not found.');
      }
      values.EMP_ID = String(employee.id);
      const ctx = await contextFor(subject, cfg, employee, null, null, null);
      genericChecks(cfg, values, check, ctx);
      await cfg.validate?.(values, check, ctx);
      check.throwIfAny();

      const id = await prisma.$transaction(async (tx) => {
        if (cfg.insert) return cfg.insert(tx, values, ctx);
        const extra = cfg.extraColumns ? await cfg.extraColumns(values, ctx) : {};
        // The file comes in its own request once the record exists: until then '' / NULL, as the column allows.
        const file = cfg.attachment ? { [cfg.attachment.column]: null } : {};
        const newId = await insertRow(
          tx, cfg.table, cfg.pk, { ...file, ...boundColumns(cfg, values, ctx), ...extra, ...ownershipColumns(cfg, employee) }, subject.userId,
        );
        await cfg.afterWrite?.(tx, newId, values, ctx);
        return newId;
      }, { timeout: 30000 });
      return { id, message: cfg.messages.created };
    },

    async update(subject: RequestSubject, rawId: string, body: unknown): Promise<{ id: number; message: string }> {
      await requireGrant(subject, cfg, 'update');
      const id = parseId(rawId);
      const row = await findRow(subject, cfg, id);
      const existing = await readValues(cfg, row);
      const values = parseBody(cfg, body);
      const check = new Checks();
      // CI disabled the employee select on edit: a record stays with its employee.
      const employee = await employeeById(Number(existing.EMP_ID));
      if (!employee) throw new NotFoundError('Employee not found.');
      values.EMP_ID = String(employee.id);
      for (const f of cfg.defs.fields) if (f.lockedOnEdit) values[f.name] = existing[f.name];
      const ctx = await contextFor(subject, cfg, employee, id, row, existing);
      genericChecks(cfg, values, check, ctx);
      await cfg.validate?.(values, check, ctx);
      check.throwIfAny();

      await prisma.$transaction(async (tx) => {
        if (cfg.update) return cfg.update(tx, values, ctx);
        const extra = cfg.extraColumns ? await cfg.extraColumns(values, ctx) : {};
        await updateRow(tx, cfg.table, cfg.pk, id, { ...boundColumns(cfg, values, ctx), ...extra, ...ownershipColumns(cfg, employee) }, subject.userId);
        await cfg.afterWrite?.(tx, id, values, ctx);
      }, { timeout: 30000 });
      return { id, message: cfg.messages.updated };
    },

    async remove(subject: RequestSubject, rawId: string): Promise<{ id: number; message: string }> {
      await requireGrant(subject, cfg, 'delete');
      const id = parseId(rawId);
      const row = await findRow(subject, cfg, id);
      const existing = await readValues(cfg, row);
      const employee = await employeeById(Number(existing.EMP_ID));
      if (!employee) throw new NotFoundError('Record not found.');
      const ctx = await contextFor(subject, cfg, employee, id, row, existing);
      await prisma.$transaction(async (tx) => {
        if (cfg.remove) return cfg.remove(tx, ctx);
        if (cfg.deleteMode === 'soft') await softDeleteRow(tx, cfg.table, cfg.pk, id, subject.userId);
        else await tx.$executeRawUnsafe(`DELETE FROM ${cfg.table} WHERE "${cfg.pk}" = $1::integer`, id);
      }, { timeout: 30000 });
      return { id, message: cfg.messages.deleted };
    },

    /** The record's attached file (CI: a public link to its uploads folder). */
    async attachment(subject: RequestSubject, rawId: string): Promise<{ name: string; data: Buffer; contentType: string | null }> {
      if (!cfg.attachment) throw new NotFoundError();
      await requireGrant(subject, cfg, 'list');
      const row = await findRow(subject, cfg, parseId(rawId));
      const name = str((await readValues(cfg, row)).attachmentName);
      if (!name) throw new NotFoundError('Document Not Found!!');
      const data = await readStored(cfg.attachment.store, name);
      return { name, data, contentType: cfg.attachment.inline?.(data) ?? null };
    },

    /** Attach (or replace) the record's file — right after the add / edit form saved the record. */
    async upload(subject: RequestSubject, rawId: string, file: unknown): Promise<{ id: number; name: string }> {
      if (!cfg.attachment) throw new NotFoundError();
      if (!(await allowed(subject, cfg, 'update')) && !(await allowed(subject, cfg, 'create'))) throw new ForbiddenError();
      if (!(file instanceof File) || !file.size) throw new ValidationError('Choose a file to upload.', { userFile: ['Choose a file to upload.'] });
      const id = parseId(rawId);
      const row = await findRow(subject, cfg, id);
      const employee = await employeeById(Number(row.__EMP_ID));
      if (!employee) throw new NotFoundError('Employee not found.');
      const extra = cfg.attachment.inspect?.(file, Buffer.from(await file.arrayBuffer())) ?? {};
      const prefix = cfg.attachment.prefix ? await cfg.attachment.prefix(id, employee) : `${id}_`;
      const name = await storeUpload(cfg.attachment.store, file, prefix);
      await updateRow(prisma, cfg.table, cfg.pk, id, { ...extra, [cfg.attachment.column]: name }, subject.userId);
      return { id, name };
    },

    /** Detach the record's file (the file itself stays on disk, as CI never deleted files). */
    async removeAttachment(subject: RequestSubject, rawId: string): Promise<{ id: number }> {
      if (!cfg.attachment) throw new NotFoundError();
      if (cfg.attachment.required) throw new BusinessRuleError('The file cannot be removed; upload another one instead.');
      await requireGrant(subject, cfg, 'update');
      const id = parseId(rawId);
      await findRow(subject, cfg, id);
      await updateRow(prisma, cfg.table, cfg.pk, id, { [cfg.attachment.column]: null }, subject.userId);
      return { id };
    },
  };
}

export type HubService = ReturnType<typeof hubService>;
