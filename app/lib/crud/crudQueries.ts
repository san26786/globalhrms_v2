// app/lib/crud/crudQueries.ts

import { CrudFilters } from "@/lib/crud/crudTypes";

export class CrudQueries {
  static buildWhere(filters?: CrudFilters) {
    const where: Record<string, unknown> = {};

    if (!filters) return where;

    if (filters.search) {
      where.OR = [];
    }

    if (filters.filters) {
      Object.assign(where, filters.filters);
    }

    return where;
  }

  static buildOrder(filters?: CrudFilters) {
    if (!filters?.sortBy) return undefined;

    return {
      [filters.sortBy]: filters.sortOrder ?? "asc",
    };
  }

  static buildPagination(filters?: CrudFilters) {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;

    return {
      skip: (page - 1) * limit,
      take: limit,
    };
  }
}