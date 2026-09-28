"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, PlusCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/DataTable";
import type { BulkAction, RowAction } from "@/components/DataTable/types";
import ConfirmDelete from "@/components/Dialog/ConfirmDelete";
import ListViewShell, { type ListAction } from "@/components/listview/ListViewShell";
import { authFetch } from "@/lib/auth/authFetch";
import { useIndexPage } from "@/lib/table-builder/useIndexPage";
import { useListColumns } from "@/lib/entity/display/useListColumns";
import type { ColumnSetting } from "@/lib/import-export/ExportService";

export interface ResourceListColumn<T> {
  key: keyof T & string;
  header: string;
  /**
   * The entity attribute (DB column, CI OBJ_ATTRBT_NM) this column shows. When set, the column
   * follows the list's Form Settings: its label and list visibility come from the entity config.
   */
  attribute?: string;
  /** Optional custom cell (badges, formatting). */
  cell?: (row: T) => React.ReactNode;
  /** Server-side sort column (must be one of the resource's sortFields). Omit = not sortable. */
  sortKey?: string;
  /**
   * Query parameter of one of the resource's declared `filters` (ResourceDefinition.filters) — gives
   * this column a box in the filter row. Resource filters are EXACT matches applied by the API across
   * all pages. Columns without one get no box: the API ignores unknown parameters, and filtering
   * only the current page on the client would hide matching rows on other pages.
   */
  filterParam?: string;
}

interface ResourceListPageProps<T> {
  title: string;
  /** Module slug for export/import controls, e.g. "systm-setting". */
  entity: string;
  /** API collection endpoint, e.g. "/api/systmInfoMgr/systm_setting". */
  apiPath: string;
  /** Page base path; add = `${basePath}/add`, edit = `${basePath}/edit/{id}`. */
  basePath: string;
  columns: ResourceListColumn<T>[];
  getId: (row: T) => number | string;
  /** CI $pvs_ObjNm (e.g. 'user_role_vw'): enables the Form Settings cog for admins. */
  objectName?: string;
  searchPlaceholder?: string;
  /** Hide the add/edit/delete actions even when permitted (read-only screens). */
  readOnly?: boolean;
  extraRowActions?: RowAction<T>[];
  /** Module-specific header buttons (CI $listActions after the Add action). */
  listActions?: ListAction[];
  params?: Record<string, string>;
  /** Overrides the add link (default `${basePath}/add`), e.g. to carry a query string. */
  addHref?: string;
  /** Overrides the edit link (default `${basePath}/edit/{id}`). */
  editHref?: (row: T) => string;
  /** Hides Edit / Delete for individual rows. */
  canEditRow?: (row: T) => boolean;
  canDeleteRow?: (row: T) => boolean;
  /** CI $deleteAll === false: hide "Delete Selected". */
  deleteAll?: boolean;
  /** Extra controls rendered above the table (CI listview $customFields). */
  toolbar?: (ctx: { refresh: () => void }) => React.ReactNode;
}

/**
 * Standard CI list view (listview_v) on the shared ListViewShell + DataTable: server-side paging,
 * search and sort; Add / Edit / Delete / Delete Selected shown only when the API reports the
 * caller may do them; column labels and visibility follow the object's Form Settings.
 */
export default function ResourceListPage<T>({
  title,
  entity,
  apiPath,
  basePath,
  columns,
  getId,
  objectName,
  searchPlaceholder = "Search...",
  readOnly = false,
  extraRowActions = [],
  listActions = [],
  params,
  addHref,
  editHref,
  canEditRow,
  canDeleteRow,
  deleteAll = true,
  toolbar,
}: ResourceListPageProps<T>) {
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = useState<T[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<T[]>([]);
  const [filterParams, setFilterParams] = useState<Record<string, string>>({});

  const { data, loading, error, server, permissions, refresh, tableRef } = useIndexPage<T>({
    apiPath,
    entity,
    serverSide: true,
    params: { ...params, ...filterParams },
    columns: [],
  });
  const { columns: configured, reload: reloadColumns } = useListColumns(objectName);

  // Apply the Form Settings to columns bound to an attribute; unbound columns are always shown.
  const effectiveColumns = useMemo(
    () =>
      columns.flatMap((c) => {
        const cfg = c.attribute && configured?.size ? configured.get(c.attribute.toUpperCase()) : undefined;
        if (cfg && !cfg.visibleInList) return [];
        return [{ ...c, header: cfg?.label || c.header }];
      }),
    [columns, configured],
  );

  // The column id is what DataTable reports as the sort key, so it is the server sort column.
  const tableColumns: ColumnDef<T, unknown>[] = effectiveColumns.map((c) => ({
    id: c.sortKey ?? c.key,
    accessorKey: c.key,
    header: c.header,
    enableSorting: !!c.sortKey,
    enableColumnFilter: !!c.filterParam,
    ...(c.cell ? { cell: ({ row }) => c.cell!(row.original) } : {}),
  }));

  const canDelete = !readOnly && permissions.delete;
  const deletable = (rows: T[]) => (canDeleteRow ? rows.filter(canDeleteRow) : rows);

  const rowActions: RowAction<T>[] = [
    ...(!readOnly && permissions.update
      ? [
          {
            label: "Edit",
            icon: Pencil,
            show: canEditRow,
            onClick: (row: T) => router.push(editHref ? editHref(row) : `${basePath}/edit/${getId(row)}`),
          },
        ]
      : []),
    ...extraRowActions,
    ...(canDelete
      ? [
          {
            label: "Delete",
            icon: Trash2,
            variant: "destructive" as const,
            separator: true,
            show: canDeleteRow,
            onClick: (row: T) => setPendingDelete([row]),
          },
        ]
      : []),
  ];

  const bulkActions: BulkAction<T>[] | undefined =
    canDelete && deleteAll
      ? [{ label: "Delete Selected", icon: Trash2, variant: "destructive", onClick: (rows) => setPendingDelete(deletable(rows)) }]
      : undefined;

  const columnSettings: ColumnSetting[] = effectiveColumns.map((c) => ({
    systemName: c.key,
    displayName: c.header,
    visibleInList: true,
    visibleInForm: true,
  }));

  const headerActions: ListAction[] = [
    ...(!readOnly && permissions.create
      ? [{ key: "add", title: `Add New ${title}`, icon: PlusCircle, href: addHref ?? `${basePath}/add` }]
      : []),
    ...listActions,
  ];

  const confirmDelete = async () => {
    if (!pendingDelete?.length) return;
    setDeleting(true);
    const results = await Promise.allSettled(
      pendingDelete.map(async (row) => {
        const res = await authFetch(`${apiPath}/${getId(row)}`, { method: "DELETE" });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) throw new Error(json?.message ?? "Delete failed.");
      }),
    );
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    const okCount = results.length - failed.length;
    if (okCount) toast.success(okCount === 1 ? "Record deleted." : `${okCount} records deleted.`);
    if (failed.length) toast.error(failed.length === 1 ? (failed[0].reason as Error).message : `${failed.length} records could not be deleted.`);
    setDeleting(false);
    setPendingDelete(null);
    setSelected([]);
    refresh();
  };

  return (
    <ListViewShell
      title={title}
      listActions={headerActions}
      exportConfig={{ entity, filename: entity, columnSettings, data: data as unknown[], tableRef, onImported: refresh }}
      objectName={objectName}
      onConfigSaved={() => {
        reloadColumns();
        refresh();
      }}
      onDeleteSelected={bulkActions ? () => setPendingDelete(deletable(selected)) : undefined}
      selectedCount={selected.length}
      filters={toolbar?.({ refresh })}
    >
      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      <DataTable
        columns={tableColumns}
        data={data}
        isLoading={loading && data.length === 0}
        serverSide={
          server && {
            ...server,
            // Filter row → the resource's declared filter parameters (column id → filterParam).
            onColumnFiltersChange: (filters) =>
              setFilterParams(
                Object.fromEntries(
                  effectiveColumns.flatMap((c) => {
                    const value = filters[c.sortKey ?? c.key];
                    return c.filterParam && value ? [[c.filterParam, value]] : [];
                  }),
                ),
              ),
          }
        }
        searchPlaceholder={searchPlaceholder}
        rowActions={rowActions.length ? rowActions : undefined}
        rowActionsVariant="inline"
        selectable
        bulkActions={bulkActions}
        onRowSelectionChange={setSelected}
        getRowId={(row) => String(getId(row))}
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
