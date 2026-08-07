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
