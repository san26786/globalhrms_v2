// app/lib/crud/crudService.ts

import {
  CrudCreateSchema,
  CrudDeleteSchema,
  CrudUpdateSchema,
} from "@/lib/crud/crudValidation";

import {
  CrudEntityConfig,
  CrudFilters,
} from "@/lib/crud/crudTypes";

import { CrudRepository } from "@/lib/crud/crudRepository";

export class CrudService {

  private repository: CrudRepository;

  constructor(config: CrudEntityConfig) {
    this.repository = new CrudRepository(config);
  }

  async getAll(filters?: CrudFilters) {
    return this.repository.findAll(filters);
  }

  async get(id: number | string) {
    return this.repository.findById(id);
  }

  async create(data: Record<string, unknown>) {
    CrudCreateSchema.parse(data);
    return this.repository.create(data);
  }

  async update(
    id: number | string,
    values: Record<string, unknown>
  ) {
    CrudUpdateSchema.parse({
      id,
      values,
    });

    return this.repository.update(id, values);
  }

  async delete(id: number | string) {
    CrudDeleteSchema.parse({ id });
    return this.repository.delete(id);
  }
}