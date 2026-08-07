"use client";

import { type Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { BulkAction } from "./types";

interface DataTableBulkActionsProps<TData> {
  table: Table<TData>;
  actions: BulkAction<TData>[];
}

/**
 * Floating action bar that appears once one or more rows are selected.
 * Renders above the table body, e.g. "3 selected · Delete · Export · ✕".
 */
export function DataTableBulkActions<TData>({
  table,
  actions,
}: DataTableBulkActionsProps<TData>) {
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const count = selectedRows.length;

  if (count === 0) return null;

  const selectedData = selectedRows.map((r) => r.original);

  return (
    <div className="flex items-center gap-3 rounded-md border bg-muted/50 px-3 py-2">
      <span className="text-sm font-medium">
        {count} row{count > 1 ? "s" : ""} selected
      </span>
      <Separator orientation="vertical" className="h-5" />
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {actions.map((action) => (
          <Button
            key={action.label}
            size="sm"
            variant={action.variant ?? "outline"}
            className="h-8"
            onClick={() => action.onClick(selectedData)}
          >
            {action.icon && <action.icon className="mr-2 h-4 w-4" />}
            {action.label}
          </Button>
        ))}
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="h-8"
        onClick={() => table.resetRowSelection()}
      >
        <X className="mr-1 h-4 w-4" />
        Clear
      </Button>
    </div>
  );
}
