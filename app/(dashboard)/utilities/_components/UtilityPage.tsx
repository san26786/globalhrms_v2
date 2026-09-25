"use client";

import type { ReactNode } from "react";
import { ChevronRight, Wrench } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { SelectOption } from "@/lib/form-builder/formTypes";

/** Card header used by the utilities screens (same markup as the systmInfoMgr detail pages). */
export function UtilityPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4">
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Utilities</span>
          <ChevronRight size={15} className="text-slate-400" />
          <span className="font-semibold text-blue-600">{title}</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Wrench className="text-blue-600 h-6 w-6" />
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-800">{title}</h1>
        </div>
      </div>
      {children}
    </div>
  );
}

export function UtilityCard({ children }: { children: ReactNode }) {
  return <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">{children}</div>;
}

/** Plain (uncontrolled-by-form) select with the DynamicForm look. */
export function PlainSelect({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = "Select an option",
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className="h-9 px-3 rounded-lg border border-gray-300">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="max-h-60">
          {options.map((o) => (
            <SelectItem key={String(o.value)} value={String(o.value)}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
