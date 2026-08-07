"use client";

import * as React from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

import { DataTableToolbar } from "./DataTableToolbar";
import { DataTablePagination } from "./DataTablePagination";
import { DataTableSkeleton } from "./DataTableSkeleton";
import { DataTableBulkActions } from "./DataTableBulkActions";
import { DataTableEmpty } from "./DataTableEmpty";
import { DataTableActions } from "./DataTableActions";
import type { DataTableProps } from "./types";

/**
 * Prepend this to your columns array to get a checkbox-select column
 * with header "select all" wired up automatically.
 *
 *   const columns = [selectionColumn<User>(), ...baseColumns];
 */
export function selectionColumn<TData>(): ColumnDef<TData, unknown> {
  return {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        onClick={(e) => e.stopPropagation()}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 32,
  };
}

/**
 * Generic, reusable CRUD data table built on TanStack Table v8 + shadcn/ui.
 * Handles search, faceted filters, sorting, pagination, row selection,
 * bulk actions, loading, and empty states so entity pages only need to
 * supply `columns` + `data`.
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  searchColumnId,
  searchPlaceholder,
  facetedFilters,
  onAdd,
  addLabel,
  rowActions,
  bulkActions,
  serverSide,
  pageSize = 10,
  pageSizeOptions,
  emptyTitle,
  emptyDescription,
  onRowSelectionChange,
  onRowClick,
  getRowId,
  className,
  entity,
  search,
}: DataTableProps<TData, TValue>) {
  const entityName = entity?.replace("/", "");
  const searchType = search?.includes("search") ? "search" : "global";
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>(
    {}
  );
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

  const isServerSide = !!serverSide;
  const enableRowSelection = !!bulkActions?.length;

  // Auto-append a kebab-menu actions column when `rowActions` is supplied,
  // unless the caller already defined their own `id: "actions"` column.
  const resolvedColumns = React.useMemo<ColumnDef<TData, TValue>[]>(() => {
    if (!rowActions?.length) return columns;
    if (columns.some((c) => c.id === "actions")) return columns;

    const actionsColumn: ColumnDef<TData, TValue> = {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <DataTableActions row={row.original} actions={rowActions} />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 48,
    };
    return [...columns, actionsColumn];
  }, [columns, rowActions]);

  const table = useReactTable({
    data,
    columns: resolvedColumns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
      globalFilter: searchColumnId ? undefined : globalFilter,
    },
    enableRowSelection,
    getRowId,
    manualPagination: isServerSide,
    manualSorting: isServerSide,
    manualFiltering: isServerSide,
    pageCount: isServerSide ? serverSide!.pageCount : undefined,
    onSortingChange: (updater) => {
      setSorting(updater);
      if (isServerSide && serverSide?.onSortingChange) {
        const next = typeof updater === "function" ? updater(sorting) : updater;
        serverSide.onSortingChange(next);
      }
    },
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: (updater) => {
      setRowSelection(updater);
    },
    onPaginationChange: (updater) => {
      setPagination(updater);
      if (isServerSide && serverSide?.onPaginationChange) {
        const next =
          typeof updater === "function" ? updater(pagination) : updater;
        serverSide.onPaginationChange(next);
      }
    },
    onGlobalFilterChange: (value) => {
      setGlobalFilter(value);
      serverSide?.onGlobalFilterChange?.(value);
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: isServerSide ? undefined : getFilteredRowModel(),
    getPaginationRowModel: isServerSide ? undefined : getPaginationRowModel(),
    getSortedRowModel: isServerSide ? undefined : getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  // Search: either bound to one column's filter, or the table's global filter.
  const searchValue = searchColumnId
    ? ((table.getColumn(searchColumnId)?.getFilterValue() as string) ?? "")
    : globalFilter;

  const handleSearchChange = (value: string) => {
    if (searchColumnId) {
      table.getColumn(searchColumnId)?.setFilterValue(value);
    } else {
      table.setGlobalFilter(value);
    }
  };

  React.useEffect(() => {
    if (!onRowSelectionChange) return;
    const selected = table
      .getFilteredSelectedRowModel()
      .rows.map((r) => r.original);
    onRowSelectionChange(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowSelection]);

  const rows = table.getRowModel().rows;
  const isFiltered = searchValue.length > 0 || columnFilters.length > 0;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <DataTableToolbar
        table={table}
        searchValue={searchValue}
        onSearchChange={handleSearchChange}
        searchPlaceholder={searchPlaceholder}
        facetedFilters={facetedFilters}
        onAdd={onAdd}
        addLabel={addLabel}
      />

      {bulkActions && bulkActions.length > 0 && (
        <DataTableBulkActions table={table} actions={bulkActions} />
      )}

      {isLoading ? (
        <DataTableSkeleton
          columnCount={resolvedColumns.length}
          withSelection={enableRowSelection}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} style={{ width: header.getSize() }}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(onRowClick && "cursor-pointer")}
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={resolvedColumns.length} className="h-auto p-0">
                    <DataTableEmpty
                      title={emptyTitle}
                      description={emptyDescription}
                      isFiltered={isFiltered}
                      onAdd={onAdd}
                      addLabel={addLabel}
                      onClearFilters={() => {
                        handleSearchChange("");
                        table.resetColumnFilters();
                      }}
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <DataTablePagination
        table={table}
        pageSizeOptions={pageSizeOptions}
        totalRows={isServerSide ? serverSide!.pageCount * pagination.pageSize : undefined}
      />
    </div>
  );
}
