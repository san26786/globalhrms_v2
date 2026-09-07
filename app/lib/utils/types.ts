// lib/utils/types.ts
//
// Small, generic TypeScript utility types shared across the framework and
// consuming modules (CRUD, Entity, Dynamic Tables, etc). Pure type-level
// code only — no runtime exports here.

/** A value that may also be null. */
export type Nullable<T> = T | null;

/** A value that may also be null or undefined. */
export type Optional<T> = T | null | undefined;

/** Recursively makes every property of T optional. */
export type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

/** Common identifier shape used across CRUD/Entity records (matches CrudIdSchema). */
export type ID = string | number;

/** A single sort instruction, as commonly consumed by table/query builders. */
export interface SortSpec {
  field: string;
  direction: "asc" | "desc";
}

/** Standard shape for a paginated list result. */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}