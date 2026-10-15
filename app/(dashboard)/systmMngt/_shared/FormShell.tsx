"use client";

import type { ReactNode } from "react";
import { ChevronRight, Database, Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The shared DynamicForm look (header card with Save / Save and Add / Cancel, then a form card) for
 * screens whose controls DynamicForm has no field type for (rich text, file upload, variable rows).
 */
export default function FormShell({
  title,
  breadcrumb,
  mode,
  busy,
  onSave,
  onSaveAndAdd,
  onCancel,
  children,
}: {
  title: string;
  breadcrumb: string[];
  mode: "add" | "edit";
  busy: boolean;
  onSave: () => void;
  onSaveAndAdd?: () => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  return (
    <div className="p-4">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                {breadcrumb.map((c) => (
                  <span key={c} className="flex items-center gap-2">
                    {c}
                    <ChevronRight size={15} className="text-slate-400" />
                  </span>
                ))}
                <span className="font-semibold text-blue-600">{mode === "add" ? "Add" : "Edit"}</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Database className="h-6 w-6 text-blue-600" />
                <h1 className="text-2xl font-bold tracking-tight text-slate-800 md:text-3xl">{title}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="icon" title="Save" aria-label="Save" disabled={busy} onClick={onSave} className="rounded-full bg-blue-600 text-white shadow-md hover:bg-blue-700">
                <Save className="h-5 w-5" />
              </Button>
              {mode === "add" && onSaveAndAdd && (
                <Button type="button" size="icon" title="Save and Add" aria-label="Save and Add" disabled={busy} onClick={onSaveAndAdd} className="rounded-full bg-emerald-600 text-white shadow-md hover:bg-emerald-700">
                  <Plus className="h-5 w-5" />
                </Button>
              )}
              <Button type="button" variant="outline" size="icon" title="Cancel" aria-label="Cancel" onClick={onCancel} className="rounded-full border-slate-200 text-slate-600">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
        <form
          className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          aria-busy={busy}
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
        >
          {children}
        </form>
      </div>
    </div>
  );
}

/** Label + control + error, one form row. */
export function Row({ label, htmlFor, required, error, children }: { label: string; htmlFor?: string; required?: boolean; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}

export const selectCls =
  "h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60";
