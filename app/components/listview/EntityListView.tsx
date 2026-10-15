'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table';
import { Pencil, PlusCircle, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { DataTable } from '@/components/DataTable';
import type { BulkAction, RowAction } from '@/components/DataTable/types';
import ConfirmDelete from '@/components/Dialog/ConfirmDelete';
import ListViewShell, { type ListAction } from '@/components/listview/ListViewShell';
import { authFetch } from '@/lib/auth/authFetch';
import type { ColumnSetting } from '@/lib/import-export/ExportService';

/**
 * The generic CI list view: `<EntityListView list="dashboard_menu" />`. Everything else comes from
 * GET /api/listview/{list} — which columns, their labels and order (entity configuration, per
 * level / brand, editable in the Form Settings modal), the rows (getTableDtl with CI's scoping),
 * and which of Add / Edit / Delete the caller may use. No column is declared in page code.
 */
type Row = Record<string, unknown>;

interface ListResponse {
  success: boolean;
  message?: string;
  data: Row[];
  total: number;
  columns: Array<{ name: string; label: string }>;
  primaryKey: string;
  objNm: string;
  title: string;
  links: { add: string | null; edit: string | null; deleteApi: string | null; deleteAll: boolean; rowDelete?: boolean; sync: string | null };
}

/** A DATE column arrives as midnight UTC ("2024-04-01T00:00:00.000Z"): shown as the date only. */
const DATE_ONLY = /^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.000)?Z$/;

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  const text = String(value);
  return DATE_ONLY.exec(text)?.[1] ?? text;
}

/** What module-specific actions get: the selected rows and a list reload. */
export interface ListContext {
  selected: Row[];
  refresh: () => void;
}

export default function EntityListView({
  list,
  title,
  listActions = [],
  rowActions: extraRowActions,
  query,
  filters,
  tabs,
}: {
  /** Key of lib/listview/listDefinitions.ts. */
  list: string;
  /** Overrides the definition's title. */
  title?: string;
  /** Module-specific header buttons after Add (CI $listActions); a function gets the selection. */
  listActions?: ListAction[] | ((ctx: ListContext) => ListAction[]);
  /** Module-specific row actions after Edit / Delete (CI $actions, e.g. period_mst 'verify'). */
  rowActions?: (ctx: ListContext) => RowAction<Row>[];
  /** Page parameters forwarded to the list API (CI index($arg…), e.g. periodTypeId). */
  query?: Record<string, string>;
  /** CI $customFields: filter controls above the table. */
  filters?: ReactNode;
  /** CI tabs_v (e.g. the brand tabs OA Brands / Company Documents / Company Attributes). */
  tabs?: ReactNode;
}) {
  const router = useRouter();
  const [meta, setMeta] = useState<Omit<ListResponse, 'data' | 'total' | 'success' | 'message'> | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [version, setVersion] = useState(0);
  const [selected, setSelected] = useState<Row[]>([]);
  const [pendingDelete, setPendingDelete] = useState<Row[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const tableRef = useRef(null);
  const [syncing, setSyncing] = useState(false);
  
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const queryKey = useMemo(() => new URLSearchParams(query ?? {}).toString(), [query]);
  // A new filter starts again on page 1.
  const [seenQueryKey, setSeenQueryKey] = useState(queryKey);
  if (seenQueryKey !== queryKey) {
    setSeenQueryKey(queryKey);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams(queryKey);
    qs.set('page', String(pagination.pageIndex + 1));
    qs.set('limit', String(pagination.pageSize));
    if (debounced) qs.set('search', debounced);
    for (const [column, text] of Object.entries(columnFilters)) qs.set(`filter.${column}`, text);
    if (sorting[0]) {
      qs.set('sort', sorting[0].id);
      qs.set('dir', sorting[0].desc ? 'desc' : 'asc');
    }
    authFetch(`/api/listview/${encodeURIComponent(list)}?${qs}`, { cache: 'no-store' })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as ListResponse | null;
        if (!res.ok || !json?.success) throw new Error(json?.message ?? `Failed to load the list (${res.status}).`);
        return json;
      })
      .then((json) => {
        if (cancelled) return;
        const { data, total: count, ...rest } = json;
        setRows(data);
        setTotal(count);
        setMeta(rest);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load the list.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [list, queryKey, pagination, sorting, debounced, columnFilters, version]);

  const pk = meta?.primaryKey ?? 'ID';
  const idOf = useCallback((row: Row) => String(row[pk] ?? ''), [pk]);

  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () =>
      (meta?.columns ?? []).map((c) => ({
        id: c.name,
        accessorFn: (row: Row) => row[c.name],
        header: c.label,
        enableSorting: true,
        cell: ({ row }) => formatCell(row.original[c.name]),
      })),
    [meta?.columns],
  );

  const links = meta?.links;
  const rowActions: RowAction<Row>[] = [
    ...(links?.edit ? [{ label: 'Edit', icon: Pencil, onClick: (row: Row) => router.push(`${links.edit}/${encodeURIComponent(idOf(row))}`) }] : []),
    ...(links?.deleteApi && links.rowDelete !== false
      ? [{ label: 'Delete', icon: Trash2, variant: 'destructive' as const, onClick: (row: Row) => setPendingDelete([row]) }]
      : []),
    ...(extraRowActions ? extraRowActions({ selected, refresh }) : []),
  ];
  const bulkActions: BulkAction<Row>[] | undefined = links?.deleteAll
    ? [{ label: 'Delete Selected', icon: Trash2, variant: 'destructive', onClick: (sel) => setPendingDelete(sel) }]
    : undefined;

  const confirmDelete = async () => {
    if (!pendingDelete?.length || !links?.deleteApi) return;
    setDeleting(true);
    const results = await Promise.allSettled(
      pendingDelete.map(async (row) => {
        const res = await authFetch(`${links.deleteApi}/${encodeURIComponent(idOf(row))}`, { method: 'DELETE' });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) throw new Error(json?.message ?? 'Delete failed.');
      }),
    );
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    const okCount = results.length - failed.length;
    if (okCount) toast.success(okCount === 1 ? 'Record deleted.' : `${okCount} records deleted.`);
    if (failed.length) toast.error(failed.length === 1 ? (failed[0].reason as Error).message : `${failed.length} records could not be deleted.`);
    setDeleting(false);
    setPendingDelete(null);
    setSelected([]);
    refresh();
  };

  const handleSync = async () => {
    if (!links?.sync || syncing) return;
    // Sync replaces data on the server (Permission Class: every permission row of the brand), so ask first.
    if (!window.confirm('Sync replaces the current data with the default configuration. Continue?')) return;
    setSyncing(true);
    try {
      const res = await authFetch(links.sync, { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.message ?? 'Sync failed.');
      toast.success(json.message ?? 'Permissions synced.');
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const columnSettings: ColumnSetting[] = (meta?.columns ?? []).map((c) => ({
    systemName: c.name,
    displayName: c.label,
    visibleInList: true,
    visibleInForm: true,
  }));

  const headerActions: ListAction[] = [
    ...(links?.add ? [{ key: 'add', title: `Add New ${title ?? meta?.title ?? ''}`.trim(), icon: PlusCircle, href: links.add }] : []),
    ...(links?.sync ? [{ key: 'sync', title: 'Sync', icon: RefreshCw, onClick: handleSync, disabled: syncing }] : []),
    ...(typeof listActions === 'function' ? listActions({ selected, refresh }) : listActions),
  ];

  return (
    <ListViewShell
      title={title ?? meta?.title ?? ''}
      listActions={headerActions}
      exportConfig={{ entity: list, filename: list, columnSettings, data: rows, tableRef, onImported: refresh }}
      objectName={meta?.objNm}
      onConfigSaved={refresh}
      onDeleteSelected={bulkActions ? () => setPendingDelete(selected) : undefined}
      selectedCount={selected.length}
      filters={filters}
      tabs={tabs}
    >
      {error && <p className="text-sm text-red-500">{error}</p>}

      <DataTable
        columns={columns}
        data={rows}
        isLoading={loading && rows.length === 0}
        searchPlaceholder="Search..."
        rowActions={rowActions.length ? rowActions : undefined}
        rowActionsVariant="inline"
        selectable
        bulkActions={bulkActions}
        onRowSelectionChange={setSelected}
        // Row position is part of the key: migrated data has duplicate primary keys (e.g. 734 menu
        // ids appear twice in menu_config_vw), which would collide as React keys / selections.
        // Delete still uses the row's real primary key (idOf).
        getRowId={(row, i) => `${idOf(row)}#${i}`}
        serverSide={{
          pageCount: Math.max(1, Math.ceil(total / pagination.pageSize)),
          totalRows: total,
          onPaginationChange: setPagination,
          onSortingChange: setSorting,
          onGlobalFilterChange: setSearch,
          onColumnFiltersChange: setColumnFilters,
          isFetching: loading,
        }}
      />

      <ConfirmDelete
        open={pendingDelete !== null}
        loading={deleting}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </ListViewShell>
  );
}
