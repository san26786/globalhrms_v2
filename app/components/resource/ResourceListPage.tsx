"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/DataTable";
import type { RowAction } from "@/components/DataTable/types";
import ConfirmDelete from "@/components/Dialog/ConfirmDelete";
import BreadcrumbHeader from "@/lib/page-builder/pageBreadcrumbHeader";
import { authFetch } from "@/lib/auth/authFetch";
import { useIndexPage } from "@/lib/table-builder/useIndexPage";
import type { ColumnSetting } from "@/lib/import-export/ExportService";

export interface ResourceListColumn<T> {
  key: keyof T & string;
  header: string;
  /** Optional custom cell (badges, formatting). */
  cell?: (row: T) => React.ReactNode;
  /** Server-side sort column (must be one of the resource's sortFields). Omit = not sortable. */
  sortKey?: string;
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
  searchPlaceholder?: string;
  /** Hide the add/edit/delete actions even when permitted (read-only screens). */
  readOnly?: boolean;
  extraRowActions?: RowAction<T>[];
  params?: Record<string, string>;
  /** Overrides the add link (default `${basePath}/add`), e.g. to carry a query string. */
  addHref?: string;
  /** Overrides the edit link (default `${basePath}/edit/{id}`). */
  editHref?: (row: T) => string;
  /** Hides Edit / Delete for individual rows. */
  canEditRow?: (row: T) => boolean;
  canDeleteRow?: (row: T) => boolean;
  /** Extra controls rendered between the header and the table (CI listview customFields / listActions). */
  toolbar?: (ctx: { refresh: () => void }) => React.ReactNode;
}

/**
 * Standard CI list view (listview_v) on the shared DataTable: server-side paging, search and
 * sort; Add / Edit / Delete shown only when the API reports the caller may do them.
 */
export default function ResourceListPage<T>({
  title,
  entity,
  apiPath,
  basePath,
  columns,
  getId,
  searchPlaceholder = "Search...",
  readOnly = false,
  extraRowActions = [],
  params,
  addHref,
  editHref,
  canEditRow,
  canDeleteRow,
  toolbar,
}: ResourceListPageProps<T>) {
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = useState<T | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data, loading, error, server, permissions, refresh, tableRef } = useIndexPage<T>({
    apiPath,
    entity,
    serverSide: true,
    params,
    columns: [],
  });

  // The column id is what DataTable reports as the sort key, so it is the server sort column.
  const tableColumns: ColumnDef<T, unknown>[] = columns.map((c) => ({
    id: c.sortKey ?? c.key,
    accessorKey: c.key,
    header: c.header,
    enableSorting: !!c.sortKey,
    ...(c.cell ? { cell: ({ row }) => c.cell!(row.original) } : {}),
  }));

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
    ...(!readOnly && permissions.delete
      ? [
          {
            label: "Delete",
            icon: Trash2,
            variant: "destructive" as const,
            separator: true,
            show: canDeleteRow,
            onClick: (row: T) => setPendingDelete(row),
          },
        ]
      : []),
  ];

  const columnSettings: ColumnSetting[] = columns.map((c) => ({
    systemName: c.key,
    displayName: c.header,
    visibleInList: true,
    visibleInForm: true,
  }));

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await authFetch(`${apiPath}/${getId(pendingDelete)}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Delete failed.");
      toast.success("Record deleted.");
      setPendingDelete(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <BreadcrumbHeader
        entity={entity}
        title={title}
        filename={entity}
        columnSettings={columnSettings}
        data={data as unknown[]}
        tableRef={tableRef}
        onSuccess={refresh}
        addHref={!readOnly && permissions.create ? (addHref ?? `${basePath}/add`) : undefined}
      />

      {toolbar?.({ refresh })}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <DataTable
        columns={tableColumns}
        data={data}
        isLoading={loading && data.length === 0}
        serverSide={server}
        searchPlaceholder={searchPlaceholder}
        rowActions={rowActions.length ? rowActions : undefined}
        getRowId={(row) => String(getId(row))}
      />

      <ConfirmDelete
        open={pendingDelete !== null}
        loading={deleting}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
