import type { ZodType } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import type { RequestSubject } from '@/lib/auth/getSubject';

/**
 * A "resource" is one CRUD-able table as seen by the API: which model, which columns may be
 * searched/sorted, how rows are scoped to the tenant, how deletes work, who may do what, and how
 * validated input becomes a database row.
 *
 * Resources are declared in code today (lib/<module>/<name>.resource.ts). The Entity framework
 * will later produce the same ResourceDefinition from metadata, so there is one CRUD engine for
 * both — see ResourceService.
 */

export type ResourceAction = 'list' | 'read' | 'create' | 'update' | 'delete';

export interface ResourceContext {
  subject: RequestSubject;
  now: Date;
}

export interface AccessPolicy {
  /** Returns whether `subject` may perform `action`. Never throws for a plain "no". */
  check(subject: RequestSubject, action: ResourceAction): Promise<boolean>;
}

/**
 * Row scoping, reproducing CI getTableDtl():
 *   sysadmin (2)  → no filter
 *   admin (1)     → brandColumn = active brand
 *   user (0)      → userColumn = own user id when mode = 'ci' and a userColumn is set,
 *                   otherwise brandColumn = active brand
 * mode 'brand' always uses the brand filter for levels 0 and 1; mode 'none' never filters
 * (global/system tables such as systm_glssry).
 * The same scope is applied to read, update and delete, so a record outside the caller's scope
 * behaves as "not found" (no IDOR).
 */
export interface TenancyConfig {
  mode: 'ci' | 'brand' | 'none';
  /** Stamped on insert from the session (org / brand / user). */
  orgColumn?: string;
  brandColumn?: string;
  userColumn?: string;
  /** Admin (level 1) rows are scoped by brand (default) or by organisation (CI orgColumName = OA_ID). */
  scopeBy?: 'brand' | 'org';
  /** Column holding the row owner for level-0 "own rows" scoping, when different from userColumn (e.g. CREATED_BY). */
  ownerColumn?: string;
  /**
   * CI shows the Organisation/Brand selectors (OrgDetailsView) to the system admin only; when set,
   * a sysadmin may pass `oaBrandId` in the body to create the record for another brand (the org is
   * taken from that brand). Everyone else is always stamped with their session org/brand.
   */
  sysAdminMayChooseBrand?: boolean;
  /**
   * CI models that store NULL organisation/brand for records a sysadmin creates (global rows,
   * e.g. config_mapping_dtl_m::insert). The user column is still stamped.
   */
  sysAdminRowsAreGlobal?: boolean;
}

export interface SoftDeleteConfig {
  column: string;
  deleted: number | boolean;
  active: number | boolean;
  /** Treat NULL as not deleted (many migrated rows have NULL flags). */
  nullIsActive?: boolean;
}

export interface AuditConfig {
  createdBy?: string;
  createdOn?: string;
  updatedBy?: string;
  updatedOn?: string;
}

export interface ResourceHooks<TCreate, TUpdate> {
  /** Business-rule validation before insert (uniqueness, combinations…). Throw AppErrors. */
  beforeCreate?(input: TCreate, ctx: ResourceContext): Promise<void>;
  beforeUpdate?(id: number, input: TUpdate, existing: Record<string, unknown>, ctx: ResourceContext): Promise<void>;
  beforeDelete?(id: number, existing: Record<string, unknown>, ctx: ResourceContext): Promise<void>;
  /** Adds display data (names of referenced masters/brands/users) to a page of rows in batch — no N+1. */
  enrichRows?(rows: Record<string, unknown>[], ctx: ResourceContext): Promise<Record<string, unknown>[]>;
}

export interface ResourceDefinition<TCreate = unknown, TUpdate = unknown, TRow = Record<string, unknown>> {
  /** Human-readable name used in messages, e.g. "System Setting". */
  label: string;
  /** Prisma model delegate name (== table name in this schema). */
  model: Prisma.ModelName;
  /** Physical table, used by the insert-safety guard. Defaults to `model`. */
  table?: string;
  primaryKey: string;
  /** Columns returned by list/read. Omit to return all columns. */
  select?: Record<string, true>;
  /** Text columns searched (case-insensitive contains) by `?search=`. */
  searchFields?: string[];
  sortFields: string[];
  defaultSort: { field: string; dir: 'asc' | 'desc' };
  /** Allowed exact-match list filters: query param → column + value parser. */
  filters?: Record<string, { column: string; parse: (raw: string) => unknown }>;
  tenancy: TenancyConfig;
  softDelete?: SoftDeleteConfig;
  audit?: AuditConfig;
  policy: AccessPolicy;
  createSchema?: ZodType<TCreate>;
  updateSchema?: ZodType<TUpdate>;
  toCreateData?(input: TCreate, ctx: ResourceContext): Record<string, unknown> | Promise<Record<string, unknown>>;
  toUpdateData?(input: TUpdate, ctx: ResourceContext): Record<string, unknown> | Promise<Record<string, unknown>>;
  toDto?(row: Record<string, unknown>): TRow;
  hooks?: ResourceHooks<TCreate, TUpdate>;
}

export interface ListQuery {
  page: number;
  limit: number;
  search?: string;
  sort?: string;
  dir?: 'asc' | 'desc';
  filters: Record<string, string>;
}

export interface ListResult<TRow> {
  rows: TRow[];
  total: number;
  page: number;
  limit: number;
}

export interface ResourcePermissions {
  create: boolean;
  update: boolean;
  delete: boolean;
}
