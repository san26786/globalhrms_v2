"use client";

import { type Table } from "@tanstack/react-table";
import { Plus, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import type { FacetedFilter } from "./types";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  facetedFilters?: FacetedFilter[];
  onAdd?: () => void;
  addLabel?: string;
}

export function DataTableToolbar<TData>({
  table,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  facetedFilters = [],
  onAdd,
  addLabel = "Add",
}: DataTableToolbarProps<TData>) {
  const isFiltered =
    searchValue.length > 0 || table.getState().columnFilters.length > 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 pl-8"
          />
        </div>

        {facetedFilters.map((filter) => (
          <DataTableFacetedFilter
            key={filter.columnId}
            table={table}
            filter={filter}
          />
        ))}

        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => {
              onSearchChange("");
              table.resetColumnFilters();
            }}
            className="h-9 px-2 lg:px-3"
          >
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onAdd && (
          <Button size="sm" className="h-9" onClick={onAdd}>
            <Plus className="mr-2 h-4 w-4" />
            {addLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Multi-select facet filter, e.g. Status: Draft, Published, Archived. */
function DataTableFacetedFilter<TData>({
  table,
  filter,
}: {
  table: Table<TData>;
  filter: FacetedFilter;
}) {
  const column = table.getColumn(filter.columnId);
  if (!column) return null;

  const selected = new Set(column.getFilterValue() as string[] | undefined);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 border-dashed">
          <Plus className="mr-2 h-4 w-4" />
          {filter.title}
          {selected.size > 0 && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge
                variant="secondary"
                className="rounded-sm px-1 font-normal lg:hidden"
              >
                {selected.size}
              </Badge>
              <div className="hidden gap-1 lg:flex">
                {selected.size > 2 ? (
                  <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                    {selected.size} selected
                  </Badge>
                ) : (
                  filter.options
                    .filter((o) => selected.has(o.value))
                    .map((o) => (
                      <Badge
                        variant="secondary"
                        key={o.value}
                        className="rounded-sm px-1 font-normal"
                      >
                        {o.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <Command>
          <CommandInput placeholder={filter.title} />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {filter.options.map((option) => {
                const isSelected = selected.has(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                      const next = new Set(selected);
                      if (isSelected) next.delete(option.value);
                      else next.add(option.value);
                      const values = Array.from(next);
                      column.setFilterValue(values.length ? values : undefined);
                    }}
                  >
                    <Checkbox checked={isSelected} className="mr-2" />
                    {option.icon && (
                      <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    )}
                    <span>{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selected.size > 0 && (
              <>
                <CommandSeparatorFix />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => column.setFilterValue(undefined)}
                    className="justify-center text-center"
                  >
                    Clear filters
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Small local alias to avoid importing CommandSeparator just for one spot.
function CommandSeparatorFix() {
  return <div className="-mx-1 my-1 h-px bg-border" />;
}
