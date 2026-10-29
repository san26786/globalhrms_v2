"use client";

import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { RowAction } from "./types";

interface DataTableActionsProps<TData> {
  row: TData;
  actions: RowAction<TData>[];
}

/**
 * Kebab (⋯) menu for a single table row. Wire it up as the cell renderer of
 * an `id: "actions"` column: `cell: ({ row }) => <DataTableActions row={row.original} actions={...} />`.
 */
export function DataTableActions<TData>({
  row,
  actions,
}: DataTableActionsProps<TData>) {
  const visibleActions = actions.filter((a) => a.show?.(row) ?? true);

  if (visibleActions.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-8 w-8 p-0 data-[state=open]:bg-accent"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {visibleActions.map((action, i) => (
          <div key={action.label}>
            {action.separator && i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              disabled={action.disabled?.(row) ?? false}
              className={cn(
                action.variant === "destructive" &&
                  "text-destructive focus:text-destructive"
              )}
              onClick={(e) => {
                e.stopPropagation();
                action.onClick(row);
              }}
            >
              {action.icon && <action.icon className="mr-2 h-4 w-4" />}
              {action.label}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * CI listview style row actions: one small icon button per action (edit = blue, delete = red),
 * rendered in the "Actions" column (DataTable rowActionsVariant="inline").
 */
export function DataTableInlineActions<TData>({
  row,
  actions,
}: DataTableActionsProps<TData>) {
  const visibleActions = actions.filter((a) => a.show?.(row) ?? true);
  if (visibleActions.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {visibleActions.map((action) => {
        const Icon = action.icon ?? MoreHorizontal;
        return (
          <Button
            key={action.label}
            type="button"
            variant="ghost"
            size="icon"
            title={action.label}
            aria-label={action.label}
            disabled={action.disabled?.(row) ?? false}
            className={cn(
              "h-7 w-7",
              action.variant === "destructive"
                ? "text-red-600 brand:text-rose-700 dark:text-rose-300 hover:text-red-700 brand:hover:text-rose-800 dark:hover:text-rose-200 hover:bg-red-50 brand:hover:bg-rose-50 dark:hover:bg-rose-400/10"
                : "text-blue-600 brand:text-[#0b5394] dark:text-[#8cb8f0] hover:text-blue-700 brand:hover:text-[#083f72] dark:hover:text-[#cfe1fa] hover:bg-blue-50 brand:hover:bg-[#e3edf9] dark:hover:bg-[#16233d]"
            )}
            onClick={(e) => {
              e.stopPropagation();
              action.onClick(row);
            }}
          >
            <Icon className="h-4 w-4" />
          </Button>
        );
      })}
    </div>
  );
}
