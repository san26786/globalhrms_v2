// app/lib/crud/crudTypes.ts

export interface CrudFilters {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Record<string, unknown>;
}

export interface CrudResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface CrudCreateInput {
  [key: string]: unknown;
}

export interface CrudUpdateInput {
  id: number | string;
  values: Record<string, unknown>;
}

export interface CrudDeleteInput {
  id: number | string;
}

export interface CrudEntityConfig {
  table: string;
  primaryKey: string;
}