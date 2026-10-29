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
        <div className="rounded-3xl border bg-white dark:bg-[#111a2e] p-6 shadow-sm brand:relative brand:border-slate-200 dark:border-white/10 brand:shadow-[0_1px_2px_rgba(16,24,40,0.04)] brand:before:absolute brand:before:inset-x-8 brand:before:top-0 brand:before:h-1 brand:before:rounded-b-full brand:before:bg-gradient-to-r brand:before:from-[#e15425] brand:before:to-[#0b5394]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 brand:text-[#535768] dark:text-[#aab3c5]">
                {breadcrumb.map((c) => (
                  <span key={c} className="flex items-center gap-2">
                    {c}
                    <ChevronRight size={15} className="text-slate-400 brand:text-[#535768] dark:text-[#aab3c5]" />
                  </span>
                ))}
                <span className="font-semibold text-blue-600 brand:text-[#0b5394] dark:text-[#8cb8f0]">{mode === "add" ? "Add" : "Edit"}</span>
              </div>
              <div className="mt-2 flex items-center gap-2 brand:mt-3 brand:gap-3">
                <Database className="h-6 w-6 text-blue-600 brand:h-11 brand:w-11 brand:shrink-0 brand:rounded-xl brand:bg-[#fbe6dd] brand:p-2.5 brand:text-[#b4441f] dark:bg-[#da5427]/15 dark:text-[#f8a27e]" />
                <h1 className="text-2xl font-bold brand:font-semibold tracking-tight text-slate-800 brand:text-[#1a1818] dark:text-[#f1f3f8] md:text-3xl brand:text-[28px] brand:leading-tight brand:tracking-[-0.03em] brand:text-[#1a1818] dark:text-[#f1f3f8] brand:md:text-[32px]">{title}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="icon" title="Save" aria-label="Save" disabled={busy} onClick={onSave} className="rounded-full bg-blue-600 brand:bg-[#e15425] text-white shadow-md hover:bg-blue-700 brand:hover:bg-[#c2431c]">
                <Save className="h-5 w-5" />
              </Button>
              {mode === "add" && onSaveAndAdd && (
                <Button type="button" size="icon" title="Save and Add" aria-label="Save and Add" disabled={busy} onClick={onSaveAndAdd} className="rounded-full bg-emerald-600 brand:bg-emerald-700 text-white shadow-md hover:bg-emerald-700 brand:hover:bg-emerald-800">
                  <Plus className="h-5 w-5" />
                </Button>
              )}
              <Button type="button" variant="outline" size="icon" title="Cancel" aria-label="Cancel" onClick={onCancel} className="rounded-full border-slate-200 dark:border-white/10 text-slate-600 brand:text-[#323338] dark:text-[#d5dae4]">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
        <form
          className="space-y-5 rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111a2e] p-6 shadow-sm"
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
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700 brand:text-[#1a1818] dark:text-[#e6e9f0]">
        {label} {required && <span className="text-red-500 brand:text-rose-700 dark:text-rose-300">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 brand:text-rose-700 dark:text-rose-300" role="alert">{error}</p>}
    </div>
  );
}

export const selectCls =
  "h-9 w-full rounded-lg border border-gray-300 brand:border-[#e2e4ea] dark:border-[#2a3550] bg-white dark:bg-[#111a2e] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 brand:focus:ring-[#e15425]/40 disabled:opacity-60";
