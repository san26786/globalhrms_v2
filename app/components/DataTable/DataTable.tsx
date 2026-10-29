"use client";

import * as React from "react";
import {
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
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
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { DataTableToolbar } from "./DataTableToolbar";
import { DataTablePagination } from "./DataTablePagination";
import { DataTableSkeleton } from "./DataTableSkeleton";
import { DataTableBulkActions } from "./DataTableBulkActions";
import { DataTableEmpty } from "./DataTableEmpty";
import { DataTableActions, DataTableInlineActions } from "./DataTableActions";
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
  rowActionsVariant = "menu",
  selectable = false,
  bulkActions,
  serverSide,
  pageSize = 10,
  pageSizeOptions,
  emptyTitle,
  emptyDescription,
  onRowSelectionChange,
  onSelectionChange,
  columnFilterRow = true,
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
  const enableRowSelection = selectable || !!bulkActions?.length;

  // Auto-append a kebab-menu actions column when `rowActions` is supplied,
  // unless the caller already defined their own `id: "actions"` column.
  const resolvedColumns = React.useMemo<ColumnDef<TData, TValue>[]>(() => {
    // Leading checkbox column whenever rows are selectable (header = select all / indeterminate).
    const withSelect = (cols: ColumnDef<TData, TValue>[]) =>
      enableRowSelection && !cols.some((c) => c.id === "select")
        ? [selectionColumn<TData>() as ColumnDef<TData, TValue>, ...cols]
        : cols;
    if (!rowActions?.length) return withSelect(columns);
    if (columns.some((c) => c.id === "actions")) return withSelect(columns);

    if (rowActionsVariant === "inline") {
      const inlineColumn: ColumnDef<TData, TValue> = {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => <DataTableInlineActions row={row.original} actions={rowActions} />,
        enableSorting: false,
        enableHiding: false,
        size: 96,
      };
      return withSelect([inlineColumn, ...columns]);
    }

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
    return withSelect([...columns, actionsColumn]);
  }, [columns, rowActions, rowActionsVariant, enableRowSelection]);

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
    defaultColumn: { filterFn: includesText as FilterFn<TData> },
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
    onColumnFiltersChange: (updater) => {
      const next = typeof updater === "function" ? updater(columnFilters) : updater;
      setColumnFilters(next);
      if (isServerSide && serverSide?.onColumnFiltersChange) {
        // Server paging: the filter must be applied by the API across all pages, from page 1.
        const firstPage = { pageIndex: 0, pageSize: pagination.pageSize };
        setPagination(firstPage);
        serverSide.onPaginationChange(firstPage);
        serverSide.onColumnFiltersChange(
          Object.fromEntries(next.filter((f) => typeof f.value === "string" && f.value !== "").map((f) => [f.id, f.value as string]))
        );
      }
    },
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
      if (isServerSide) {
        // A new search starts again from the first page on the server.
        const firstPage = { pageIndex: 0, pageSize: pagination.pageSize };
        setPagination(firstPage);
        serverSide?.onPaginationChange(firstPage);
      }
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

  React.useEffect(() => {
    onSelectionChange?.(Object.keys(rowSelection).filter((id) => rowSelection[id]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowSelection]);

  // Filter row: columns with an accessor that allow filtering. On server-paged tables only when the
  // server applies the filters (onColumnFiltersChange) — never filter just the current page.
  const [filterResetKey, setFilterResetKey] = React.useState(0);
  const canFilterColumn = (column: Column<TData, unknown>) =>
    columnFilterRow &&
    column.getCanFilter() &&
    typeof column.accessorFn !== "undefined" &&
    (!isServerSide || !!serverSide?.onColumnFiltersChange);
  const showFilterRow = table.getAllLeafColumns().some((c) => canFilterColumn(c as Column<TData, unknown>));

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
        <div className="rounded-md border brand:overflow-hidden brand:rounded-2xl brand:border-slate-200 brand:bg-white brand:shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-white/10 dark:bg-[#111a2e]">
          <Table>
            <TableHeader className="brand:bg-[#f6f7f9] dark:bg-white/5">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} style={{ width: header.getSize() }} className="brand:h-11 brand:text-[13px] brand:font-semibold brand:text-[#323338] dark:text-[#d5dae4]">
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
              {showFilterRow && (
                <TableRow className="hover:bg-transparent">
                  {table.getVisibleLeafColumns().map((column) => (
                    <TableHead key={column.id} className="py-2">
                      {canFilterColumn(column as Column<TData, unknown>) ? (
                        <ColumnFilterInput
                          key={`${column.id}:${filterResetKey}`}
                          label={typeof column.columnDef.header === "string" ? column.columnDef.header : column.id}
                          initialValue={(column.getFilterValue() as string) ?? ""}
                          onChange={(value) => column.setFilterValue(value || undefined)}
                        />
                      ) : null}
                    </TableHead>
                  ))}
                </TableRow>
              )}
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn("brand:transition-colors brand:hover:bg-[#fdf3ee] dark:hover:bg-white/5", onRowClick && "cursor-pointer")}
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
                        setFilterResetKey((k) => k + 1);
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
        totalRows={isServerSide ? (serverSide!.totalRows ?? serverSide!.pageCount * pagination.pageSize) : undefined}
      />
    </div>
  );
}


/**
 * Default column filter: case-insensitive "contains" on the cell's text (CI DataTables column
 * search). An array value (faceted filters) matches any of its entries exactly.
 */
function includesText(row: { getValue: (id: string) => unknown }, columnId: string, filterValue: unknown): boolean {
  const cell = row.getValue(columnId);
  if (Array.isArray(filterValue)) return filterValue.length === 0 || filterValue.includes(String(cell));
  const needle = String(filterValue ?? "").trim().toLowerCase();
  return needle === "" || String(cell ?? "").toLowerCase().includes(needle);
}
includesText.autoRemove = (value: unknown) => value === undefined || value === "" || (Array.isArray(value) && value.length === 0);

/** One filter box in the filter row; reports its value 300 ms after the user stops typing. */
function ColumnFilterInput({
  label,
  initialValue,
  onChange,
}: {
  label: string;
  initialValue: string;
  onChange: (value: string) => void;
}) {
  const [value, setValue] = React.useState(initialValue);
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  });
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => onChangeRef.current(value.trim()), 300);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      aria-label={`Filter ${label}`}
      className="h-8 min-w-20 bg-white dark:bg-[#111a2e] text-xs font-normal"
    />
  );
}
