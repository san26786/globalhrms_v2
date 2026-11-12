"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Award, Check, Pin, X } from "lucide-react";
import { toast } from "sonner";

import EntityListView, { type ListContext } from "@/components/listview/EntityListView";
import type { ListAction } from "@/components/listview/ListViewShell";
import SearchableSelect from "@/components/forms/SearchableSelect";
import { authFetch } from "@/lib/auth/authFetch";

/**
 * CI timesheet/timesheet::userProjects: the brand's projects with the user's settings
 * (listDefinitions 'user_projects') and the selection actions Enable / Disable / Set Default /
 * Set Current. Administrators pick the employee (CI T_EMP_ID + View); without one they configure
 * the brand defaults.
 */
type Row = Record<string, unknown>;
type Action = "enable" | "disable" | "default" | "current";

const PAGE = "/timesheet/timesheet/userProjects";

export default function UserProjectsList({ userId }: { userId: string }) {
  const router = useRouter();
  const [employees, setEmployees] = useState<Array<{ value: string; label: string }> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Administrators only (403 otherwise): employees keyed by their user id (CI T_EMP_ID held the user).
    authFetch("/api/timesheet/timesheet/projects/employees", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!cancelled && res.ok && json?.success) setEmployees(json.data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const query = useMemo(() => (userId ? { userId } : undefined), [userId]);

  const run = async (action: Action, selected: Row[], refresh: () => void) => {
    if (!selected.length) return toast.error("Please select project!!");
    setBusy(true);
    try {
      const res = await authFetch(`/api/timesheet/timesheet/projects/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected.map((r) => Number(r.PROJECT_ID)), userId: userId || undefined }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
      if (!res.ok || !json?.success) throw new Error(json?.message ?? "The action failed.");
      toast.success(json.message ?? "Done.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The action failed.");
    } finally {
      setBusy(false);
    }
  };

  const listActions = ({ selected, refresh }: ListContext): ListAction[] => [
    { key: "enable", title: "Enable Project(s)", icon: Check, disabled: busy, onClick: () => void run("enable", selected, refresh) },
    { key: "disable", title: "Disable Project(s)", icon: X, disabled: busy, onClick: () => void run("disable", selected, refresh) },
    { key: "default", title: "Set Default Project(s)", icon: Pin, disabled: busy, onClick: () => void run("default", selected, refresh) },
    { key: "current", title: "Set Current", icon: Award, disabled: busy, onClick: () => void run("current", selected, refresh) },
  ];

  return (
    <EntityListView
      list="user_projects"
      title="Configure Projects"
      query={query}
      listActions={listActions}
      filters={
        employees ? (
          <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#111a2e]">
            <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-[#d5dae4]">
              Employee
              <SearchableSelect
                ariaLabel="Employee"
                placeholder="Brand defaults (all employees)"
                value={userId || "0"}
                options={employees}
                onChange={(v) => router.push(v === "0" ? PAGE : `${PAGE}?userId=${v}`)}
              />
            </label>
          </div>
        ) : undefined
      }
    />
  );
}
