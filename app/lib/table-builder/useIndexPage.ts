'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { authFetch } from '@/lib/auth/authFetch';
import { buildTable } from '@/lib/table-builder/tableBuilder';
import type { DisplayField } from '@/lib/table-builder/columnBuilder';
import type { ColumnSetting } from '@/lib/import-export/ExportService';

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
}

export interface IndexPageState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  columns: ReturnType<typeof buildTable<T>>['columns'];
  columnSettings: ColumnSetting[];
  tableRef: React.MutableRefObject<any>;
  refresh: () => void;
}

/**
 * Client-side counterpart to CI's Xxx_c::index() → common_c::getTableDtl().
 * Any module's list page calls this with a handful of props instead of
 * re-implementing fetch/loading/columns each time.
 */
export function useIndexPage<T = any>(
  config: IndexPageConfig<T>
): IndexPageState<T> {
  const { apiPath, entity, columns: fixedColumns } = config;

  const [data, setData] = useState<T[]>([]);
  const [displayFields, setDisplayFields] = useState<DisplayField[]>(
    fixedColumns ?? []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tableRef = useRef<any>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(apiPath);
      const json = await res.json();
      setData(json.data ?? []);

      // Server-driven columns win unless the caller pinned an explicit set.
      if (!fixedColumns && Array.isArray(json.columns)) {
        setDisplayFields(json.columns);
      }
    } catch (err) {
      console.error(`Failed to fetch ${entity} entries`, err);
      setError(err instanceof Error ? err.message : 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [apiPath, entity, fixedColumns]);

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

  return { data, loading, error, columns, columnSettings, tableRef, refresh: fetchData };
}