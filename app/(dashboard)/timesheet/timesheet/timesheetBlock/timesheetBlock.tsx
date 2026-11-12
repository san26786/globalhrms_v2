"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Download, Eye, Loader2, Pencil, Plus, Send } from "lucide-react";
import { toast } from "sonner";

import ListViewShell, { type ListAction } from "@/components/listview/ListViewShell";
import SearchableSelect from "@/components/forms/SearchableSelect";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth/authFetch";
import { hrefForCi } from "@/lib/navigation/routeRegistry";
import type { BlockData } from "@/lib/timesheet/timesheetBlock";

/**
 * CI timesheetBlock_v: the month's timesheet periods as cards — dates, the timesheet's status and
 * Add Timesheet Item (New Timesheet Item for the period), Request Approval (Draft) and View
 * Timesheet. Previous / Next month; administrators choose the employee and export the month.
 */
const PAGE = "/timesheet/timesheet/timesheetBlock";
const show = (day: string) => format(parseISO(day), "dd.MM.yyyy");

export default function TimesheetBlock({ month, empId }: { month: string; empId: string }) {
  const router = useRouter();
  const [data, setData] = useState<BlockData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams();
    if (month) qs.set("month", month);
    if (empId) qs.set("empId", empId);
    authFetch(`/api/timesheet/timesheet/block?${qs}`, { cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string; data?: BlockData } | null;
        if (!res.ok || !json?.success || !json.data) throw new Error(json?.message ?? "Failed to load the timesheet periods.");
        if (!cancelled) {
          setData(json.data);
          setError(null);
        }
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Failed to load the timesheet periods."));
    return () => {
      cancelled = true;
    };
  }, [month, empId, version]);

  const go = useCallback(
    (next: { month?: string; empId?: string }) => {
      const qs = new URLSearchParams();
      const m = next.month ?? month;
      const e = next.empId ?? empId;
      if (m) qs.set("month", m);
      if (e && e !== "0") qs.set("empId", e);
      router.push(qs.size ? `${PAGE}?${qs}` : PAGE);
    },
    [month, empId, router],
  );

  const submit = async (tsId: number) => {
    setBusy(tsId);
    try {
      const res = await authFetch(`/api/timesheet/timesheet/${tsId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
      if (!res.ok || !json?.success) throw new Error(json?.message ?? "Request Approval failed.");
      toast.success(json.message ?? "Timesheet submitted for Approval");
      setVersion((v) => v + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request Approval failed.");
    } finally {
      setBusy(null);
    }
  };

  const download = async (kind: "details" | "hours") => {
    try {
      const res = await authFetch(`/api/timesheet/timesheet/export/${kind}?month=${data?.month ?? ""}`);
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(json?.message ?? "Export failed.");
      }
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? `timesheet-${kind}.csv`;
      const url = URL.createObjectURL(await res.blob());
      Object.assign(document.createElement("a"), { href: url, download: name }).click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed.");
    }
  };

  const dashboard = hrefForCi("dashboard/dashboard_timesheet");
  const actions: ListAction[] = [
    ...(dashboard ? [{ key: "dashboard", title: "View Dashboard", icon: Eye, href: dashboard }] : []),
    ...(data?.isAdmin
      ? [
          { key: "details", title: "Export Timesheet Details", icon: Download, onClick: () => void download("details") },
          { key: "hours", title: "Export Timesheet Hours", icon: Clock, onClick: () => void download("hours") },
        ]
      : []),
  ];

  const filters = data?.isAdmin ? (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#111a2e]">
      <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-[#d5dae4]">
        Employee
        <SearchableSelect
          ariaLabel="Employee"
          placeholder="Select Employee"
          value={empId || "0"}
          options={data.employees.map((o) => ({ value: String(o.value), label: o.label }))}
          onChange={(v) => go({ empId: v })}
        />
      </label>
    </div>
  ) : undefined;

  return (
    <ListViewShell title="Manage Timesheet" listActions={actions} exportConfig={false} filters={filters}>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!data && !error && <p className="p-6 text-sm text-slate-400">Loading…</p>}
      {data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="outline" className="rounded-full" onClick={() => go({ month: data.previous })}>
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-[#d5dae4]">
              <CalendarDays className="h-4 w-4" /> {format(parseISO(`${data.month}-01`), "MMMM yyyy")}
            </span>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => go({ month: data.next })}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {data.isAdmin && !data.employeeId && (
            <p className="text-sm text-slate-500 dark:text-[#aab3c5]">Select an employee to see their timesheets.</p>
          )}
          {data.periods.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-white/15">
              No timesheet periods start in this month.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.periods.map((p) => {
              const ts = p.timesheet;
              const current = p.periodId === data.currentPeriodId;
              return (
                <article
                  key={p.periodId}
                  className={`flex flex-col justify-between gap-3 rounded-2xl border bg-white p-4 text-center shadow-sm dark:bg-[#111a2e] ${
                    current
                      ? "border-blue-400 ring-2 ring-blue-200 brand:border-[#e15425] brand:ring-[#fbe6dd] dark:ring-blue-500/30"
                      : "border-slate-200 dark:border-white/10"
                  }`}
                >
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-[#f1f3f8]">{p.description}</h3>
                    <p className="text-sm font-medium text-slate-600 dark:text-[#d5dae4]">
                      {show(p.start)} To {show(p.end)}
                    </p>
                    {ts && (
                      <p className="text-xs font-bold uppercase tracking-wide text-blue-700 brand:text-[#0b5394] dark:text-[#8cb8f0]">{ts.status}</p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Link
                      href={`/timesheet/new_timesheet_item?date=${p.start}`}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      <Plus className="h-4 w-4" /> Add Timesheet Item
                    </Link>
                    {ts && ts.statusId === data.statuses.draft && (
                      <Button type="button" disabled={busy !== null} onClick={() => void submit(ts.id)} className="h-9 rounded-full">
                        {busy === ts.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Request Approval
                      </Button>
                    )}
                    {ts && (
                      <Link
                        href={`/timesheet/timesheet/edit/${ts.id}`}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white/10"
                      >
                        <Pencil className="h-4 w-4" /> View Timesheet
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </ListViewShell>
  );
}
