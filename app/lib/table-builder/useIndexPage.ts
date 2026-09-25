'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PaginationState, SortingState } from '@tanstack/react-table';
import { authFetch } from '@/lib/auth/authFetch';
import { buildTable } from '@/lib/table-builder/tableBuilder';
import type { DisplayField } from '@/lib/table-builder/columnBuilder';
import type { ColumnSetting } from '@/lib/import-export/ExportService';
import type { ServerSideState } from '@/components/DataTable/types';

export interface IndexPageConfig<T> {
  /** List endpoint — the Next.js equivalent of passing pvs_ObjNm into common_c::getTableDtl(). */
  apiPath: string;
  /** Module slug used by <DataTable> / <ImportExportControls>, e.g. 'dashboard-menu'. */
  entity: string;
  /**
   * Column definitions. Optional — if the endpoint returns a `columns`
   * array (server-driven, same idea as CI's entity_obj_attrbt-based
   * getVisibleColForLV()), that's used instead and no module has to
   * declare its own list. Pass this only to pin/override columns for a
   * module whose API doesn't emit them yet.
   */
  columns?: DisplayField[];
  /**
   * Server-side paging/search/sort (CI's DataTables server mode). The endpoint must accept
   * ?page&limit&search&sort&dir and return { data, total, permissions? } — every lib/resource
   * endpoint does. Leave unset for endpoints that return the whole list (client-side paging).
   */
  serverSide?: boolean;
  pageSize?: number;
  /** Extra fixed query params, e.g. { typeId: '12' }. */
  params?: Record<string, string>;
}

export interface ListPermissions {
  create: boolean;
  update: boolean;
  delete: boolean;
}

export interface IndexPageState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  columns: ReturnType<typeof buildTable<T>>['columns'];
  columnSettings: ColumnSetting[];
  tableRef: React.MutableRefObject<any>;
  refresh: () => void;
  /** Present when `serverSide` is set: pass straight to <DataTable serverSide={...} />. */
  server?: ServerSideState;
  total: number;
  /** What the caller may do, as reported by the endpoint (all false until loaded). */
  permissions: ListPermissions;
}

const NO_PERMISSIONS: ListPermissions = { create: false, update: false, delete: false };

/**
 * Client-side counterpart to CI's Xxx_c::index() → common_c::getTableDtl().
 * Any module's list page calls this with a handful of props instead of
 * re-implementing fetch/loading/columns each time.
 */
export function useIndexPage<T = any>(
  config: IndexPageConfig<T>
): IndexPageState<T> {
  const { apiPath, entity, columns: fixedColumns, serverSide = false, pageSize = 10, params } = config;

  const [data, setData] = useState<T[]>([]);
  const [serverColumns, setServerColumns] = useState<DisplayField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [permissions, setPermissions] = useState<ListPermissions>(NO_PERMISSIONS);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const tableRef = useRef<any>(null);

  // Server-driven columns win unless the caller pinned an explicit set.
  // Depend on the boolean, not the array: callers typically pass an inline
  // literal, which is a new reference every render and would otherwise
  // re-create fetchData and re-trigger the effect on every state update.
  const hasFixedColumns = fixedColumns !== undefined;
  const displayFields = fixedColumns ?? serverColumns;
  const paramsKey = params ? JSON.stringify(params) : '';

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const url = useMemo(() => {
    if (!serverSide) return apiPath;
    const qs = new URLSearchParams(paramsKey ? (JSON.parse(paramsKey) as Record<string, string>) : {});
    qs.set('page', String(pagination.pageIndex + 1));
    qs.set('limit', String(pagination.pageSize));
    if (debouncedSearch) qs.set('search', debouncedSearch);
    if (sorting[0]) {
      qs.set('sort', sorting[0].id);
      qs.set('dir', sorting[0].desc ? 'desc' : 'asc');
    }
    return `${apiPath}${apiPath.includes('?') ? '&' : '?'}${qs.toString()}`;
  }, [apiPath, serverSide, paramsKey, pagination, debouncedSearch, sorting]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(url);
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.message ?? `Request failed with status ${res.status}`);
      }
      setData(json.data ?? []);
      setTotal(typeof json.total === 'number' ? json.total : (json.data ?? []).length);
      if (json.permissions) setPermissions(json.permissions);

      if (!hasFixedColumns && Array.isArray(json.columns)) {
        setServerColumns(json.columns);
      }
    } catch (err) {
      console.error(`Failed to fetch ${entity} entries`, err);
      setData([]);
      setTotal(0);
      setError(err instanceof Error ? err.message : 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [url, entity, hasFixedColumns]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { columns } = buildTable<T>(displayFields);

  const columnSettings: ColumnSetting[] = displayFields.map((f) => ({
    systemName: f.accessorKey,
    displayName: f.header,
    visibleInList: f.visible !== false,
    visibleInForm: f.visible !== false,
  }));

  const server: ServerSideState | undefined = serverSide
    ? {
        pageCount: Math.max(1, Math.ceil(total / pagination.pageSize)),
        totalRows: total,
        isFetching: loading,
        onPaginationChange: setPagination,
        onSortingChange: (next) => {
          setSorting(next);
          setPagination((p) => ({ ...p, pageIndex: 0 }));
        },
        onGlobalFilterChange: (value) => {
          setSearch(value);
          setPagination((p) => ({ ...p, pageIndex: 0 }));
        },
      }
    : undefined;

  return { data, loading, error, columns, columnSettings, tableRef, refresh: fetchData, server, total, permissions };
}
