"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";

import EntityListView from "@/components/listview/EntityListView";
import ListTabs from "@/components/listview/ListTabs";
import SearchableSelect from "@/components/forms/SearchableSelect";
import { authFetch } from "@/lib/auth/authFetch";
import type { TimesheetListMeta } from "@/lib/timesheet/timesheet.lists";

/**
 * CI timesheet/timesheet::index($status, $period) and ::MyTeamTimesheet($status, $period) on the
 * generic list view (listDefinitions 'timesheet' / 'timesheet_team'). This page only adds what is
 * not a button: the tabs All / Approval Pending / Approved / Rejected, the per-tab title and the
 * Timesheet Period filter (?status= / ?period=). Every header button (Add, Auto Generate, Delayed
 * Permission, My Team / My Timesheets, Approve / Reject Selected, Generate Period) is configured in
 * listDefinitions `listActions` and rendered by EntityListView.
 */
const BASE = "/timesheet/timesheet";

export default function TimesheetList({ team, status, period }: { team: boolean; status: string; period: string }) {
  const router = useRouter();
  const [meta, setMeta] = useState<TimesheetListMeta | null>(null);
  // Bumped after Generate Timesheet Period: the period filter reads the new periods.
  const [metaVersion, setMetaVersion] = useState(0);
  const page = team ? `${BASE}/team` : BASE;

  useEffect(() => {
    let cancelled = false;
    authFetch(`/api/timesheet/timesheet/meta${team ? "?team=1" : ""}`, { cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string; data?: TimesheetListMeta } | null;
        if (!res.ok || !json?.success || !json.data) throw new Error(json?.message ?? "Failed to load the timesheet settings.");
        if (!cancelled) setMeta(json.data);
      })
      .catch((e: unknown) => !cancelled && toast.error(e instanceof Error ? e.message : "Failed to load the timesheet settings."));
    return () => {
      cancelled = true;
    };
  }, [team, metaVersion]);

  const query = useMemo(() => ({ ...(status ? { status } : {}), ...(period ? { period } : {}) }), [status, period]);

  const st = meta?.statuses;
  const tabKey = !st || !status ? "all" : status === String(st.pending) ? "pending" : status === String(st.approved) ? "approved" : status === String(st.rejected) ? "rejected" : "all";
  const title = meta ? meta.titles[tabKey] : undefined;

  const href = (next: { status?: string; period?: string }) => {
    const qs = new URLSearchParams();
    if (next.status) qs.set("status", next.status);
    if (next.period) qs.set("period", next.period);
    return qs.toString() ? `${page}?${qs}` : page;
  };

  const tabs = st
    ? [
        { key: "all", label: team ? "Members All Timesheet" : "All Timesheet", href: page },
        { key: "pending", label: team ? "Members Approval Pending TS" : "Approval Pending TS", href: href({ status: String(st.pending) }) },
        { key: "approved", label: team ? "Members Approved TS" : "Approved TS", href: href({ status: String(st.approved) }) },
        { key: "rejected", label: team ? "Members Rejected TS" : "Rejected TS", href: href({ status: String(st.rejected) }) },
      ]
    : [];

  const filters = (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#111a2e]">
      <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-[#d5dae4]">
        <span className="flex items-center gap-1.5">
          <CalendarClock className="h-4 w-4" /> Timesheet Period
        </span>
        <SearchableSelect
          ariaLabel="Timesheet Period"
          placeholder="Select Timesheet Period"
          value={period || "0"}
          options={(meta?.periods ?? []).map((p) => ({ value: String(p.value), label: p.label }))}
          onChange={(v) => router.push(href({ status, period: v === "0" ? "" : v }))}
        />
      </label>
    </div>
  );

  return (
    <EntityListView
      list={team ? "timesheet_team" : "timesheet"}
      title={title}
      query={query}
      filters={filters}
      tabs={tabs.length ? <ListTabs tabs={tabs} active={tabKey} label="Timesheet status" /> : undefined}
      onActionDone={() => setMetaVersion((v) => v + 1)}
    />
  );
}
