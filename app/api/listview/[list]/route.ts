import { ok } from '@/lib/http/respond';
import { readQuery, withApi } from '@/lib/http/withApi';
import { ForbiddenError, NotFoundError } from '@/lib/http/errors';
import { getListDefinition } from '@/lib/listview/listDefinitions';
import { getTableDtl, toTableDtlSession } from '@/lib/table-builder/getTableDtl';

/**
 * GET /api/listview/{list}?page=1&limit=10&search=&sort=COLUMN&dir=asc&filter.COLUMN=text
 *
 * The generic CI list view: common_c::getTableDtl() + getTableData(). Columns (names, labels,
 * order, list visibility) come from the entity configuration for the caller's level and brand;
 * rows come from the definition's table/view with CI's scoping (brand admin → org column,
 * user → own rows), soft-delete, search, sort and paging.
 *
 * Response: { success, data: rows, total, page, limit, columns, primaryKey, objNm, permissions, links }.
 */
const MAX_LIMIT = 100;

export const GET = withApi<{ list: string }>(async ({ req, params, subject }) => {
  const def = getListDefinition(params.list);
  if (!def) throw new NotFoundError('Unknown list.');
  if (!(await def.policy.check(subject, 'list'))) throw new ForbiddenError('You do not have permission to view this list.');

  const query = readQuery(req);
  const page = Math.max(1, Math.trunc(Number(query.page) || 1));
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.trunc(Number(query.limit) || 10)));

  const [result, canCreate, canUpdate, canDelete] = await Promise.all([
    getTableDtl<Record<string, unknown>>({
      objNm: def.objNm,
      primaryKeyColumn: def.primaryKey,
      colNm: def.where?.column,
      colValue: def.where?.value,
      orgColumnName: def.orgColumn,
      orgId: subject.oaBrandId,
      userColumnName: def.userColumn,
      userId: subject.userId,
      session: toTableDtlSession(subject),
      page,
      limit,
      search: query.search,
      sort: query.sort,
      dir: query.dir === 'asc' ? 'asc' : 'desc',
      // ?filter.COLUMN=text — column search; getTableDtl ignores columns that are not listed.
      columnFilters: Object.fromEntries(
        Object.entries(query)
          .filter(([key, value]) => key.startsWith('filter.') && value.trim() !== '')
          .map(([key, value]) => [key.slice('filter.'.length), value.slice(0, 100)]),
      ),
    }),
    def.addHref ? def.policy.check(subject, 'create') : Promise.resolve(false),
    def.editHref ? def.policy.check(subject, 'update') : Promise.resolve(false),
    def.deleteApi ? def.policy.check(subject, 'delete') : Promise.resolve(false),
  ]);

  return ok(result.tableBody, {
    total: result.total,
    page,
    limit,
    columns: result.columns.map((c) => ({ name: c.name, label: c.label })),
    primaryKey: def.primaryKey,
    objNm: def.objNm,
    title: def.title,
    permissions: { create: canCreate, update: canUpdate, delete: canDelete },
    links: {
      add: canCreate ? def.addHref ?? null : null,
      edit: canUpdate ? def.editHref ?? null : null,
      deleteApi: canDelete ? def.deleteApi ?? null : null,
      deleteAll: canDelete && (def.deleteAll ?? true),
    },
  });
});
