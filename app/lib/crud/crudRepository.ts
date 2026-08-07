// app/lib/crud/crudRepository.ts

import { prisma } from "@/lib/prisma";
import { CrudEntityConfig, CrudFilters } from "@/lib/crud/crudTypes";
import { CrudQueries } from "@/lib/crud/crudQueries";

export class CrudRepository {

  constructor(
    private config: CrudEntityConfig
  ) {}

  private get model() {
    return (prisma as any)[this.config.table];
  }

  async findAll(filters?: CrudFilters) {

    const where = CrudQueries.buildWhere(filters);

    const orderBy = CrudQueries.buildOrder(filters);

    const page = CrudQueries.buildPagination(filters);

    const [data, total] = await Promise.all([
      this.model.findMany({
        where,
        orderBy,
        ...page,
      }),
      this.model.count({ where }),
    ]);

    return {
      data,
      total,
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 20,
    };
  }

  async findById(id: number | string) {
    return this.model.findUnique({
      where: {
        [this.config.primaryKey]: id,
      },
    });
  }

  async create(values: Record<string, unknown>) {
    return this.model.create({
      data: values,
    });
  }

  async update(
    id: number | string,
    values: Record<string, unknown>
  ) {
    return this.model.update({
      where: {
        [this.config.primaryKey]: id,
      },
      data: values,
    });
  }

  async delete(id: number | string) {
    return this.model.delete({
      where: {
        [this.config.primaryKey]: id,
      },
    });
  }
}