"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";

import EntityListView from "@/components/listview/EntityListView";
import SearchableSelect from "@/components/forms/SearchableSelect";
import { authFetch } from "@/lib/auth/authFetch";

/**
 * CI timesheetItem::index(): the items list (listDefinitions 'timesheet_item') with CI's Timesheet
 * Period filter, Add New Timesheet Item and row Edit / Delete.
 */
export default function TimesheetItemList({ period }: { period: string }) {
  const router = useRouter();
  const [periods, setPeriods] = useState<Array<{ value: number; label: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    authFetch("/api/timesheet/timesheet/meta", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => !cancelled && json?.success && setPeriods(json.data.periods ?? []))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const query = useMemo(() => (period ? { period } : undefined), [period]);

  return (
    <EntityListView
      list="timesheet_item"
      query={query}
      filters={
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#111a2e]">
          <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-[#d5dae4]">
            <span className="flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4" /> Timesheet Period
            </span>
            <SearchableSelect
              ariaLabel="Timesheet Period"
              placeholder="Select Timesheet Period"
              value={period || "0"}
              options={periods.map((p) => ({ value: String(p.value), label: p.label }))}
              onChange={(v) => router.push(v === "0" ? "/timesheet/timesheetItem" : `/timesheet/timesheetItem?period=${v}`)}
            />
          </label>
        </div>
      }
    />
  );
}
