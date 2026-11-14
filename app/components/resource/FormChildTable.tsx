"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, PlusCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import ConfirmDelete from "@/components/Dialog/ConfirmDelete";
import { authFetch } from "@/lib/auth/authFetch";
import type { FormTable } from "@/lib/form-init/formExtras";

/**
 * CI formview_v child table (tableHeader / tableBody / tableActions / tableEditUrl / tableDeleteUrl)
 * for an initForm payload: the rows under the form with "Add", per-row Edit and Delete. After a
 * delete `onChanged` reloads the form (totals on the parent may change).
 */
type Row = Record<string, unknown>;

/** A DATE / TIME column arrives as an ISO string: shown as the date or the time only. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  const date = /^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.000)?Z$/.exec(text);
  if (date) return date[1];
  const time = /^1970-01-01T(\d{2}:\d{2})(?::\d{2})?(?:\.000)?Z$/.exec(text);
  if (time) return time[1];
  return text;
}

export default function FormChildTable({ table, onChanged }: { table: FormTable; onChanged: () => void }) {
  const [pending, setPending] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const idOf = (row: Row) => encodeURIComponent(String(row[table.rowKey] ?? ""));
  const hasActions = !!table.editHref || !!table.deleteApi;

  const remove = async () => {
    if (!pending || !table.deleteApi) return;
    setDeleting(true);
    try {
      const res = await authFetch(`${table.deleteApi}/${idOf(pending)}`, { method: "DELETE" });
      const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string; data?: { message?: string } } | null;
      if (!res.ok || !json?.success) throw new Error(json?.message ?? "Delete failed.");
      toast.success(json.data?.message ?? "Record deleted.");
      setPending(null);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#111a2e]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-800 brand:text-[#1a1818] dark:text-[#f1f3f8]">{table.title}</h2>
        {table.addHref && (
          <Link
            href={table.addHref}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 brand:bg-[#e15425] brand:hover:bg-[#c2431c]"
          >
            <PlusCircle className="h-4 w-4" />
            {table.addLabel ?? "Add"}
          </Link>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 dark:border-white/10 dark:text-[#aab3c5]">
              {table.columns.map((c) => (
                <th key={c.name} className="px-3 py-2 font-medium">
                  {c.label}
                </th>
              ))}
              {hasActions && <th className="px-3 py-2 text-right font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {table.rows.length === 0 && (
              <tr>
                <td colSpan={table.columns.length + (hasActions ? 1 : 0)} className="px-3 py-6 text-center text-slate-400">
                  {table.emptyText ?? "No records."}
                </td>
              </tr>
            )}
            {table.rows.map((row, i) => (
              <tr key={`${String(row[table.rowKey])}#${i}`} className="border-b border-slate-100 last:border-0 dark:border-white/5">
                {table.columns.map((c) => (
                  <td key={c.name} className="px-3 py-2 text-slate-700 dark:text-[#d5dae4]">
                    {cell(row[c.name])}
                  </td>
                ))}
                {hasActions && (
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {table.editHref && (
                      <Link
                        href={`${table.editHref}/${idOf(row)}`}
                        title="Edit"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                    )}
                    {table.deleteApi && (
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => setPending(row)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDelete open={pending !== null} loading={deleting} onClose={() => setPending(null)} onConfirm={remove} />
    </section>
  );
}
