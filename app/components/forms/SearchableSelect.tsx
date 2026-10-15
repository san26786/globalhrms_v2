"use client";

import { useId, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface SearchableOption {
  value: string;
  label: string;
}

/**
 * Single select with a search box in the dropdown — the counterpart of CI's
 * `<select data-rel="chosen">`. Like chosen, the placeholder row ("Select a …", value `emptyValue`)
 * stays in the list and can be picked to clear the selection.
 */
export default function SearchableSelect({
  value,
  options,
  placeholder,
  onChange,
  emptyValue = "0",
  disabled,
  ariaLabel,
  className = "w-full sm:w-[300px]",
}: {
  value: string;
  options: SearchableOption[];
  placeholder: string;
  onChange: (value: string) => void;
  emptyValue?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const selected = options.find((o) => o.value === value);
  const rows: SearchableOption[] = [{ value: emptyValue, label: placeholder }, ...options];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={ariaLabel}
          disabled={disabled}
          className={`flex h-10 items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 text-left text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${className}`}
        >
          <span className={`truncate ${selected ? "font-medium text-slate-800" : "text-slate-500"}`}>{selected?.label ?? placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent id={listId} align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList className="max-h-64">
            <CommandEmpty>No results match.</CommandEmpty>
            {rows.map((o) => (
              <CommandItem
                key={o.value}
                // cmdk filters on `value`; the id keeps duplicate labels distinct.
                value={`${o.label} ${o.value}`}
                keywords={[o.label]}
                onSelect={() => {
                  setOpen(false);
                  if (o.value !== value) onChange(o.value);
                }}
                className="cursor-pointer"
              >
                <Check className={`mr-2 h-4 w-4 ${o.value === value ? "opacity-100" : "opacity-0"}`} />
                {o.label}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
