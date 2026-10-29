"use client";

import * as React from "react";
import {
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DataTableProps<TData, TValue> {
  columns: any;
  data: TData[];
  onTableInstance?: (table: any) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  onTableInstance,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 5,
  });

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
    },
  });

  React.useEffect(() => {
    if (onTableInstance) {
      onTableInstance(table);
    }
  }, [table, sorting, columnFilters, columnVisibility, rowSelection, pagination, onTableInstance]);

  return (
    <div className="text-base font-sans">
      <div className="flex gap-4 py-4">
        <Input
          placeholder="Filter Particulars"
          value={(table.getColumn("PARTICULARS")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("PARTICULARS")?.setFilterValue(event.target.value)
          }
          className="w-1/2 h-11 text-base rounded-xl border-slate-200 dark:border-white/10"
        />
      </div>
      <div className="rounded-md border w-full overflow-x-auto bg-white dark:bg-[#111a2e]">
        <Table className="min-w-[1600px] text-base">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="h-14 text-sm font-semibold">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-[#f6f7f9] dark:hover:bg-white/5"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-4 px-4 text-sm font-medium text-[#323338] dark:text-[#d5dae4]">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-[#535768] dark:text-[#aab3c5]"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      <div className="flex items-center justify-between py-4 border-t border-slate-100 dark:border-white/10 mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="flex items-center gap-1.5 px-4 h-10 rounded-xl border-slate-200 dark:border-white/10 text-[#323338] dark:text-[#d5dae4] hover:text-[#1a1818] dark:hover:text-white disabled:opacity-40 transition-all font-semibold active:scale-95 shadow-sm text-sm"
        >
          <ChevronLeft className="h-4.5 w-4.5" />
          Previous
        </Button>

        <div className="text-sm md:text-base text-[#535768] dark:text-[#aab3c5] font-semibold font-sans">
          {(() => {
            const pageIndex = table.getState().pagination.pageIndex;
            const pageSize = table.getState().pagination.pageSize;
            const totalRows = table.getFilteredRowModel().rows.length;

            const from = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
            const to = Math.min(totalRows, (pageIndex + 1) * pageSize);

            return `Showing ${from} - ${to} of ${totalRows}`;
          })()}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="flex items-center gap-1.5 px-4 h-10 rounded-xl border-slate-200 dark:border-white/10 text-[#323338] dark:text-[#d5dae4] hover:text-[#1a1818] dark:hover:text-white disabled:opacity-40 transition-all font-semibold active:scale-95 shadow-sm text-sm"
        >
          Next
          <ChevronRight className="h-4.5 w-4.5" />
        </Button>
      </div>
    </div>
  );
}
