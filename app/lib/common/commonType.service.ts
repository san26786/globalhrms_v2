import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { BusinessRuleError, ConflictError, ForbiddenError, ValidationError } from '@/lib/http/errors';
import { ResourceService } from '@/lib/resource/resourceService';
import { parseListQuery } from '@/lib/resource/listQuery';
import { menuPolicy, sysAdminOnly } from '@/lib/resource/policies';
import type { AccessPolicy, ListResult, ResourceDefinition, ResourcePermissions } from '@/lib/resource/types';
import {
  commonTypeCreateSchema,
  commonTypeUpdateSchema,
  type CommonTypeCreateInput,
  type CommonTypeUpdateInput,
} from '@/validations/common.schema';

/**
 * System Entities (common_type) — CI controllers/common/common_type.php + models/common/common_type_m.php.
 *
 * Business rules preserved:
 *  - list = system_entities_vw (every non-deleted type, no tenant scoping);
 *  - Type Id supplied by the user: required, integer, > 0 (zeroValidate), unique (is_unique[common_type.TYP_ID]);
 *    it is the key and cannot be changed on edit;
 *  - Type Code (upper-cased) and Type Name unique among non-deleted types — checked only when changed;
 *  - View Name required; Data Type from the existing TABLE_TYPE values; parent type optional;
 *  - delete refused while any table with a TYP_ID column still references the type
 *    ("Unable to delete Common Type Data. First delete all its dependencies."), else soft delete.
 * Access: the screen is the "System Entities" menu (common/common_type); writes are system-admin only.
 * Differences (documented): CI's dependency scan also scanned common_type itself (so every delete
 * failed) — the table itself is excluded here. Every common_type row exists twice in the migrated
 * data, so the list is de-duplicated by TYP_ID and writes update both copies.
 */

export interface CommonTypeDto {
  id: number;
  typeId: number;
  code: string;
  name: string;
  viewName: string | null;
  dataType: string | null;
  visibleToUser: boolean;
  userCanCreateData: boolean;
  isEditable: boolean;
  parentTypeId: number | null;
  parentTypeName: string | null;
}

const NOT_DELETED = { OR: [{ IS_DELETED: false }, { IS_DELETED: null }] };
const SORT_COLUMNS: Record<string, string> = { TYP_ID: 'TYP_ID', TYP_CD: 'TYP_CD', TYP_NM: 'TYP_NM', VIEW_NM: 'VIEW_NM', TABLE_TYPE: 'TABLE_TYPE' };

const readPolicy = menuPolicy('common/common_type', sysAdminOnly);
const policy: AccessPolicy = {
  async check(subject, action) {
    if (action === 'list' || action === 'read') return readPolicy.check(subject, action);
    return sysAdminOnly.check(subject, action);
  },
};

async function assertUnique(field: 'code' | 'name', column: 'TYP_CD' | 'TYP_NM', value: string, exceptTypeId?: number) {
  const clash = await prisma.common_type.findFirst({
    where: {
      ...(column === 'TYP_CD'
        ? { TYP_CD: { equals: value, mode: 'insensitive' as const } }
        : { TYP_NM: { equals: value, mode: 'insensitive' as const } }),
      ...NOT_DELETED,
      ...(exceptTypeId ? { NOT: { TYP_ID: exceptTypeId } } : {}),
    },
    select: { TYP_ID: true },
  });
  if (clash) {
    const message = field === 'code' ? 'Type Code already exists' : 'Type Name already exists';
    throw new ConflictError(message, { [field]: [message] });
  }
}

async function assertParent(input: CommonTypeUpdateInput, selfTypeId?: number) {
  if (!input.hasParent || !input.parentTypeId) return;
  if (selfTypeId && input.parentTypeId === selfTypeId) {
    throw new ValidationError('Validation failed.', { parentTypeId: ['A type cannot be its own parent.'] });
  }
  const parent = await prisma.common_type.findFirst({ where: { TYP_ID: input.parentTypeId, ...NOT_DELETED }, select: { TYP_ID: true } });
  if (!parent) throw new ValidationError('Validation failed.', { parentTypeId: ['Select a valid parent type.'] });
}

function toData(input: CommonTypeUpdateInput) {
  return {
    TYP_CD: input.code.toUpperCase(),
    TYP_NM: input.name,
    VIEW_NM: input.viewName,
    TABLE_TYPE: input.dataType,
    VISIBLE_TO_USER_FLAG: input.visibleToUser ? 1 : 0,
    USER_CAN_CREATE_DATA: input.userCanCreateData ? 1 : 0,
    IS_EDITABLE: input.isEditable,
    PARENT_TYP_ID: input.hasParent ? input.parentTypeId : null,
  };
}

/** Tables (other than common_type) with a TYP_ID column — CI delCommonType's INFORMATION_SCHEMA scan. */
async function referencingTables(): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT DISTINCT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.column_name = 'TYP_ID' AND c.table_schema = current_schema()
      AND t.table_type = 'BASE TABLE' AND c.table_name <> 'common_type'`;
  return rows.map((r) => r.table_name).filter((t) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(t));
}

async function assertNotReferenced(typeId: number) {
  const tables = await referencingTables();
  const hits = await Promise.all(
    tables.map((t) =>
      prisma.$queryRawUnsafe<Array<{ one: number }>>(`SELECT 1 AS one FROM "${t}" WHERE "TYP_ID" = $1 LIMIT 1`, typeId),
    ),
  );
  if (hits.some((rows) => rows.length > 0)) {
    throw new BusinessRuleError('Unable to delete Common Type Data. First delete all its dependencies.', 'HAS_DEPENDENCIES');
  }
}

const definition: ResourceDefinition<CommonTypeCreateInput, CommonTypeUpdateInput, CommonTypeDto> = {
  label: 'System Entity',
  model: 'common_type',
  primaryKey: 'TYP_ID',
  searchFields: ['TYP_CD', 'TYP_NM', 'VIEW_NM'],
  sortFields: Object.keys(SORT_COLUMNS),
  defaultSort: { field: 'TYP_NM', dir: 'asc' },
  tenancy: { mode: 'none' },
  softDelete: { column: 'IS_DELETED', deleted: true, active: false, nullIsActive: true },
  audit: { createdBy: 'CREATED_BY', createdOn: 'CREATED_ON', updatedBy: 'UPDATED_BY', updatedOn: 'UPDATED_ON' },
  policy,
  createSchema: commonTypeCreateSchema,
  updateSchema: commonTypeUpdateSchema,
  toCreateData: (input) => ({
    TYP_ID: input.typeId,
    ...toData(input),
    // NOT NULL columns CI left to their MySQL defaults.
    ORIGINATING_SYSTEM: '',
    APP_CD: '',
    APP_ID: 0,
    IS_DELETED: false,
  }),
  toUpdateData: (input) => toData(input),
  hooks: {
    async beforeCreate(input) {
      const taken = await prisma.common_type.findFirst({ where: { TYP_ID: input.typeId }, select: { TYP_ID: true } });
      if (taken) throw new ConflictError('The Type Id field must contain a unique value.', { typeId: ['The Type Id field must contain a unique value.'] });
      await assertUnique('code', 'TYP_CD', input.code);
      await assertUnique('name', 'TYP_NM', input.name);
      await assertParent(input);
    },
    async beforeUpdate(id, input, existing) {
      if (String(existing.TYP_CD ?? '').toUpperCase() !== input.code.toUpperCase()) await assertUnique('code', 'TYP_CD', input.code, id);
      if (String(existing.TYP_NM ?? '') !== input.name) await assertUnique('name', 'TYP_NM', input.name, id);
      await assertParent(input, id);
    },
    async beforeDelete(id) {
      await assertNotReferenced(id);
    },
    async enrichRows(rows) {
      const parentIds = [...new Set(rows.map((r) => r.PARENT_TYP_ID).filter((v): v is number => typeof v === 'number'))];
      const parents = parentIds.length
        ? await prisma.common_type.findMany({ where: { TYP_ID: { in: parentIds } }, select: { TYP_ID: true, TYP_NM: true } })
        : [];
      const name = new Map(parents.map((p) => [p.TYP_ID, p.TYP_NM]));
      return rows.map((r) => ({ ...r, _parentTypeName: name.get(r.PARENT_TYP_ID as number) ?? null }));
    },
  },
  toDto: (r) => toDto(r),
};

function toDto(r: Record<string, unknown>): CommonTypeDto {
  return {
    id: r.TYP_ID as number,
    typeId: r.TYP_ID as number,
    code: (r.TYP_CD as string) ?? '',
    name: (r.TYP_NM as string) ?? '',
    viewName: (r.VIEW_NM as string | null) ?? null,
    dataType: (r.TABLE_TYPE as string | null) ?? null,
    visibleToUser: Number(r.VISIBLE_TO_USER_FLAG ?? 0) === 1,
    userCanCreateData: Number(r.USER_CAN_CREATE_DATA ?? 0) === 1,
    isEditable: r.IS_EDITABLE === true,
    parentTypeId: (r.PARENT_TYP_ID as number | null) ?? null,
    parentTypeName: (r._parentTypeName as string | null) ?? null,
  };
}

interface CommonTypeRow {
  TYP_ID: number;
  TYP_CD: string;
  TYP_NM: string;
  VIEW_NM: string | null;
  TABLE_TYPE: string | null;
  VISIBLE_TO_USER_FLAG: number | null;
  USER_CAN_CREATE_DATA: number;
  IS_EDITABLE: boolean | null;
  PARENT_TYP_ID: number | null;
  PARENT_TYP_NM: string | null;
}

class CommonTypeService {
  private readonly crud = new ResourceService(definition);

  /** List de-duplicated by TYP_ID (the generic engine would show each migrated row twice). */
  async list(subject: RequestSubject, rawQuery: Record<string, string>): Promise<ListResult<CommonTypeDto>> {
    if (!(await policy.check(subject, 'list'))) throw new ForbiddenError();
    const query = parseListQuery(rawQuery);
    const search = query.search
      ? Prisma.sql` AND (ct."TYP_CD" ILIKE ${`%${query.search}%`} OR ct."TYP_NM" ILIKE ${`%${query.search}%`} OR ct."VIEW_NM" ILIKE ${`%${query.search}%`})`
      : Prisma.empty;
    const where = Prisma.sql`(ct."IS_DELETED" = false OR ct."IS_DELETED" IS NULL) ${search}`;
    const sortColumn = (query.sort && SORT_COLUMNS[query.sort]) || 'TYP_NM';
    const dir = query.sort && SORT_COLUMNS[query.sort] ? (query.dir === 'desc' ? 'DESC' : 'ASC') : 'ASC';
    const orderBy = Prisma.raw(`t."${sortColumn}" ${dir} NULLS LAST, t."TYP_ID" ASC`);

    const [rows, count] = await Promise.all([
      prisma.$queryRaw<CommonTypeRow[]>`
        SELECT t.*, (SELECT p."TYP_NM" FROM common_type p WHERE p."TYP_ID" = t."PARENT_TYP_ID" LIMIT 1) AS "PARENT_TYP_NM"
        FROM (
          SELECT DISTINCT ON (ct."TYP_ID") ct."TYP_ID", ct."TYP_CD", ct."TYP_NM", ct."VIEW_NM", ct."TABLE_TYPE",
                 ct."VISIBLE_TO_USER_FLAG", ct."USER_CAN_CREATE_DATA", ct."IS_EDITABLE", ct."PARENT_TYP_ID"
          FROM common_type ct
          WHERE ${where}
          ORDER BY ct."TYP_ID"
        ) t
        ORDER BY ${orderBy}
        LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`,
      prisma.$queryRaw<Array<{ total: bigint }>>`SELECT COUNT(DISTINCT ct."TYP_ID") AS total FROM common_type ct WHERE ${where}`,
    ]);

    return {
      rows: rows.map((r) => toDto({ ...r, _parentTypeName: r.PARENT_TYP_NM })),
      total: Number(count[0]?.total ?? 0),
      page: query.page,
      limit: query.limit,
    };
  }

  permissions(subject: RequestSubject): Promise<ResourcePermissions> {
    return this.crud.permissions(subject);
  }

  get(subject: RequestSubject, id: string) {
    return this.crud.get(subject, id);
  }

  async create(subject: RequestSubject, body: unknown) {
    const dto = await this.crud.create(subject, body);
    return { ...dto, message: 'System Entity Created Successfully' };
  }

  async update(subject: RequestSubject, id: string, body: unknown) {
    const dto = await this.crud.update(subject, id, body);
    return { ...dto, message: 'System Entity Updated Successfully' };
  }

  async remove(subject: RequestSubject, id: string) {
    const result = await this.crud.remove(subject, id);
    return { ...result, message: 'System Entity deleted successfully' };
  }

  /** CI common_type_m::getAllDataType — distinct TABLE_TYPE values (case-insensitive, like MySQL GROUP BY). */
  async dataTypeOptions(subject: RequestSubject): Promise<Array<{ value: string; label: string }>> {
    if (!(await policy.check(subject, 'read'))) throw new ForbiddenError();
    const rows = await prisma.common_type.findMany({
      where: { TABLE_TYPE: { not: null } },
      distinct: ['TABLE_TYPE'],
      select: { TABLE_TYPE: true },
    });
    const byKey = new Map<string, string>();
    for (const r of rows) {
      const value = (r.TABLE_TYPE ?? '').trim();
      if (!value || value === '0' || value.toUpperCase() === 'NULL') continue;
      const key = value.toUpperCase();
      // Prefer the upper-case spelling used by most rows (e.g. SYSTEM over System).
      if (!byKey.has(key) || value === key) byKey.set(key, value);
    }
    return [...byKey.values()].sort().map((v) => ({ value: v, label: v }));
  }
}

export const commonTypeService = new CommonTypeService();
