"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import EntityListView from "@/components/listview/EntityListView";
import SearchableSelect from "@/components/forms/SearchableSelect";
import { authFetch } from "@/lib/auth/authFetch";

/**
 * CI timesheet/timesheet_emp::index($empStatus) on the generic list view (listDefinitions
 * 'timesheet_emp'): row Edit / Delete and the "Sync Module" button come from the definition; this
 * page adds CI's Employment Status filter (administrators; default Current, "All" lists everyone).
 */
interface Filters {
  showFilter: boolean;
  statuses: Array<{ value: string; label: string }>;
  currentStatusId: number | null;
  allStatusId: number | null;
}

const PAGE = "/timesheet/timesheet_emp";

export default function TimesheetEmpList({ status }: { status: string }) {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters | null>(null);

  useEffect(() => {
    let cancelled = false;
    authFetch("/api/timesheet/timesheet_emp", { cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as { success?: boolean; data?: Filters } | null;
        if (!cancelled && res.ok && json?.success && json.data) setFilters(json.data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const query = useMemo(() => (status ? { status } : undefined), [status]);
  const selected = status || (filters?.currentStatusId ? String(filters.currentStatusId) : "0");

  return (
    <EntityListView
      list="timesheet_emp"
      query={query}
      filters={
        filters?.showFilter ? (
          <div className="flex flex-wrap items-end gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow duration-300 hover:shadow-[0_18px_40px_-24px_rgba(6,27,49,0.3)] dark:border-white/10 dark:bg-[#111a2e]">
            <label className="grid gap-1.5 text-[13px] font-medium text-slate-700 brand:text-[#1a1818] dark:text-[#f1f3f8]">
              Employment Status
              <SearchableSelect
                ariaLabel="Employment Status"
                placeholder="Select Employment Status"
                value={selected}
                options={filters.statuses}
                onChange={(v) => router.push(v === "0" ? PAGE : `${PAGE}?status=${v}`)}
              />
            </label>
          </div>
        ) : undefined
      }
    />
  );
}
