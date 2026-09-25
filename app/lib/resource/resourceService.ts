import { prisma } from '@/lib/prisma';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/http/errors';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { parseListQuery } from './listQuery';
import { resourceRepository } from './resourceRepository';
import type {
  ListResult,
  ResourceAction,
  ResourceContext,
  ResourceDefinition,
  ResourcePermissions,
} from './types';

type Where = Record<string, unknown>;

/**
 * Generic CRUD orchestration for one ResourceDefinition:
 *   authorize → validate → scope to tenant → business hooks → persist (soft delete, audit stamps).
 * Specialised behaviour belongs in the definition's hooks or in a dedicated domain service —
 * never in this class.
 */
export class ResourceService<TCreate, TUpdate, TRow = Record<string, unknown>> {
  constructor(private readonly def: ResourceDefinition<TCreate, TUpdate, TRow>) {}

  // ---------------------------------------------------------------- queries

  async list(subject: RequestSubject, rawQuery: Record<string, string>): Promise<ListResult<TRow>> {
    await this.authorize(subject, 'list');
    const query = parseListQuery(rawQuery);
    const where = this.and(this.scopeWhere(subject), this.activeWhere(), this.searchWhere(query.search), this.filterWhere(query.filters));

    const sortField = query.sort && this.def.sortFields.includes(query.sort) ? query.sort : this.def.defaultSort.field;
    const dir = query.sort && this.def.sortFields.includes(query.sort) ? (query.dir ?? 'asc') : this.def.defaultSort.dir;

    const [rows, total] = await Promise.all([
      resourceRepository.findMany(this.def.model, {
        where,
        ...(this.def.select ? { select: this.def.select } : {}),
        orderBy: [{ [sortField]: dir }, { [this.def.primaryKey]: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      resourceRepository.count(this.def.model, { where }),
    ]);

    const enriched = await this.enrich(rows, subject);
    return { rows: enriched.map((r) => this.dto(r)), total, page: query.page, limit: query.limit };
  }

  async get(subject: RequestSubject, rawId: string): Promise<TRow> {
    await this.authorize(subject, 'read');
    const [row] = await this.enrich([await this.findScoped(subject, this.parseId(rawId))], subject);
    return this.dto(row);
  }

  /** What the caller may do — used by list pages to show/hide Add/Edit/Delete. */
  async permissions(subject: RequestSubject): Promise<ResourcePermissions> {
    const [create, update, del] = await Promise.all([
      this.def.policy.check(subject, 'create'),
      this.def.policy.check(subject, 'update'),
      this.def.policy.check(subject, 'delete'),
    ]);
    return { create: create && !!this.def.createSchema, update: update && !!this.def.updateSchema, delete: del };
  }

  // ---------------------------------------------------------------- commands

  async create(subject: RequestSubject, body: unknown): Promise<TRow> {
    await this.authorize(subject, 'create');
    if (!this.def.createSchema || !this.def.toCreateData) throw new ForbiddenError(`${this.def.label} records cannot be created.`);
    const input = this.def.createSchema.parse(body);
    const ctx = this.context(subject);
    await this.def.hooks?.beforeCreate?.(input, ctx);

    await assertInsertSafe(this.def.table ?? this.def.model, this.def.primaryKey);
    const data = {
      ...(await this.def.toCreateData(input, ctx)),
      ...(await this.tenantStamp(subject, body)),
      ...this.auditStamp(subject, ctx.now, 'create'),
    };
    const row = await resourceRepository.create(this.def.model, { data });
    return this.dto(row);
  }

  async update(subject: RequestSubject, rawId: string, body: unknown): Promise<TRow> {
    await this.authorize(subject, 'update');
    if (!this.def.updateSchema || !this.def.toUpdateData) throw new ForbiddenError(`${this.def.label} records cannot be edited.`);
    const id = this.parseId(rawId);
    const existing = await this.findScoped(subject, id);
    const input = this.def.updateSchema.parse(body);
    const ctx = this.context(subject);
    await this.def.hooks?.beforeUpdate?.(id, input, existing, ctx);

    const data = { ...(await this.def.toUpdateData(input, ctx)), ...this.auditStamp(subject, ctx.now, 'update') };
    await resourceRepository.updateMany(this.def.model, { where: this.idWhere(subject, id), data });
    return this.dto(await this.findScoped(subject, id));
  }

  async remove(subject: RequestSubject, rawId: string): Promise<{ id: number }> {
    await this.authorize(subject, 'delete');
    const id = this.parseId(rawId);
    const existing = await this.findScoped(subject, id);
    const ctx = this.context(subject);
    await this.def.hooks?.beforeDelete?.(id, existing, ctx);

    if (this.def.softDelete) {
      await resourceRepository.updateMany(this.def.model, {
        where: this.idWhere(subject, id),
        data: { [this.def.softDelete.column]: this.def.softDelete.deleted, ...this.auditStamp(subject, ctx.now, 'update') },
      });
    } else {
      await resourceRepository.deleteMany(this.def.model, { where: this.idWhere(subject, id) });
    }
    return { id };
  }

  // ---------------------------------------------------------------- internals

  private async authorize(subject: RequestSubject, action: ResourceAction) {
    if (!(await this.def.policy.check(subject, action))) throw new ForbiddenError();
  }

  private parseId(raw: string): number {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) throw new ValidationError('Invalid id.', { id: ['Must be a positive integer.'] });
    return id;
  }

  private async findScoped(subject: RequestSubject, id: number) {
    const row = await resourceRepository.findFirst(this.def.model, {
      where: this.idWhere(subject, id),
      ...(this.def.select ? { select: this.def.select } : {}),
    });
    if (!row) throw new NotFoundError(`${this.def.label} not found.`);
    return row;
  }

  private idWhere(subject: RequestSubject, id: number): Where {
    return this.and({ [this.def.primaryKey]: id }, this.scopeWhere(subject), this.activeWhere());
  }

  private scopeWhere(subject: RequestSubject): Where | undefined {
    const { mode, orgColumn, brandColumn, userColumn, ownerColumn, scopeBy = 'brand' } = this.def.tenancy;
    if (mode === 'none' || subject.adminLevel === 2) return undefined;
    const owner = ownerColumn ?? userColumn;
    if (mode === 'ci' && subject.adminLevel === 0 && owner) return { [owner]: subject.userId };
    if (scopeBy === 'org' && orgColumn) return { [orgColumn]: subject.oaId ?? -1 };
    if (brandColumn) return { [brandColumn]: subject.oaBrandId ?? -1 };
    return undefined;
  }

  private async enrich(rows: Record<string, unknown>[], subject: RequestSubject) {
    const hook = this.def.hooks?.enrichRows;
    return hook && rows.length ? hook(rows, this.context(subject)) : rows;
  }

  private activeWhere(): Where | undefined {
    const sd = this.def.softDelete;
    if (!sd) return undefined;
    return sd.nullIsActive ? { OR: [{ [sd.column]: sd.active }, { [sd.column]: null }] } : { [sd.column]: sd.active };
  }

  private searchWhere(search?: string): Where | undefined {
    if (!search || !this.def.searchFields?.length) return undefined;
    return { OR: this.def.searchFields.map((f) => ({ [f]: { contains: search, mode: 'insensitive' } })) };
  }

  private filterWhere(filters: Record<string, string>): Where | undefined {
    const allowed = this.def.filters;
    if (!allowed) return undefined;
    const parts = Object.entries(filters)
      .filter(([key]) => allowed[key])
      .map(([key, raw]) => ({ [allowed[key].column]: allowed[key].parse(raw) }));
    return parts.length ? { AND: parts } : undefined;
  }

  private and(...parts: Array<Where | undefined>): Where {
    const present = parts.filter((p): p is Where => !!p);
    return present.length === 1 ? present[0] : { AND: present };
  }

  /**
   * CI generated models stamp org/brand/user from the session on insert. A sysadmin may target
   * another brand when the resource allows it (CI OrgDetailsView); the brand must exist.
   */
  private async tenantStamp(subject: RequestSubject, body: unknown): Promise<Where> {
    const { orgColumn, brandColumn, userColumn, sysAdminMayChooseBrand, sysAdminRowsAreGlobal } = this.def.tenancy;
    if (sysAdminRowsAreGlobal && subject.adminLevel === 2) {
      return {
        ...(orgColumn ? { [orgColumn]: null } : {}),
        ...(brandColumn ? { [brandColumn]: null } : {}),
        ...(userColumn ? { [userColumn]: subject.userId } : {}),
      };
    }
    let oaId = subject.oaId;
    let oaBrandId = subject.oaBrandId;

    const requested = Number((body as { oaBrandId?: unknown } | null)?.oaBrandId);
    if (sysAdminMayChooseBrand && subject.adminLevel === 2 && Number.isInteger(requested) && requested > 0) {
      const brand = await prisma.oa_brands.findFirst({
        where: { OA_BRAND_ID: requested, IS_DELETED: 0 },
        select: { OA_BRAND_ID: true, OA_ID: true },
      });
      if (!brand) throw new ValidationError('Validation failed.', { oaBrandId: ['Brand not found.'] });
      oaId = brand.OA_ID;
      oaBrandId = brand.OA_BRAND_ID;
    }

    return {
      ...(orgColumn && oaId !== null ? { [orgColumn]: oaId } : {}),
      ...(brandColumn && oaBrandId !== null ? { [brandColumn]: oaBrandId } : {}),
      ...(userColumn ? { [userColumn]: subject.userId } : {}),
    };
  }

  private auditStamp(subject: RequestSubject, now: Date, kind: 'create' | 'update'): Where {
    const a = this.def.audit;
    if (!a) return {};
    return kind === 'create'
      ? {
          ...(a.createdBy ? { [a.createdBy]: subject.userId } : {}),
          ...(a.createdOn ? { [a.createdOn]: now } : {}),
          ...(a.updatedBy ? { [a.updatedBy]: subject.userId } : {}),
          ...(a.updatedOn ? { [a.updatedOn]: now } : {}),
        }
      : {
          ...(a.updatedBy ? { [a.updatedBy]: subject.userId } : {}),
          ...(a.updatedOn ? { [a.updatedOn]: now } : {}),
        };
  }

  private context(subject: RequestSubject): ResourceContext {
    return { subject, now: new Date() };
  }

  private dto(row: Record<string, unknown>): TRow {
    return this.def.toDto ? this.def.toDto(row) : (row as TRow);
  }
}
