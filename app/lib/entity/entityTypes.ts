// app/lib/entity/entityTypes.ts

export interface EntityFilters {
  page?: number;
  limit?: number;
  search?: string;

  companyId?: number;
  branchId?: number;

  status?: number;
}

export interface EntityPayload {
  id?: number;

  entityName: string;
  entityCode: string;

  companyId: number;
  branchId: number;

  status: number;
}

export interface EntityListResult<T> {
  data: T[];

  total: number;

  page: number;

  limit: number;
}