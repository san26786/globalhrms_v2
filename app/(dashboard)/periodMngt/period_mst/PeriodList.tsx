"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { CalendarX, Check, Lock, LockOpen, RefreshCw, Upload } from "lucide-react";

import EntityListView, { type ListContext } from "@/components/listview/EntityListView";
import type { ListAction } from "@/components/listview/ListViewShell";
import type { RowAction } from "@/components/DataTable/types";
import PeriodFilterBar from "../components/PeriodFilterBar";
import { usePeriodFilters } from "../hooks/usePeriodFilters";
import { usePeriodActions, type ActionName } from "../hooks/usePeriodActions";
import { buildPeriodUrl } from "@/lib/periodMngt/period.url";

type Row = Record<string, unknown>;

const HEADER_ACTIONS: { action: ActionName; title: string; icon: ListAction["icon"]; usesSelection: boolean; confirm?: boolean }[] = [
  { action: "lock",     title: "Lock Period",         icon: Lock,       usesSelection: true },
  { action: "unlock",   title: "Unlock Period",       icon: LockOpen,   usesSelection: true },
  { action: "verify",   title: "Verify Period",       icon: Check,      usesSelection: true },
  { action: "sync",     title: "Syncronize Period",   icon: RefreshCw,  usesSelection: false },
  { action: "generate", title: "Generate the Period", icon: Upload,     usesSelection: false },
  { action: "close",    title: "Close Period",        icon: CalendarX,  usesSelection: true, confirm: true },
];

const idsOf = (rows: Row[]) => rows.map((r) => r.PERIOD_ID);

export default function PeriodList({ periodTypeId, periodStatusId }: { periodTypeId: string; periodStatusId: string }) {
  const router = useRouter();
  const filters = usePeriodFilters();
  const { busy, run } = usePeriodActions();

  const query = useMemo(
    () => ({ ...(periodTypeId && { periodTypeId }), ...(periodStatusId && { periodStatusId }) }),
    [periodTypeId, periodStatusId],
  );

  const listActions = ({ selected, refresh }: ListContext): ListAction[] =>
    !filters?.canManage
      ? []
      : HEADER_ACTIONS.map(({ action, title, icon, usesSelection, confirm }) => ({
          key: action,
          title,
          icon,
          disabled: busy,
          onClick: () => {
            if (confirm && selected.length && !window.confirm(`Close ${selected.length} period(s)? Closed periods are marked ended and inactive.`)) return;
            void run(action, usesSelection ? idsOf(selected) : [], refresh);
          },
        }));

  const rowActions = ({ refresh }: ListContext): RowAction<Row>[] => [
    { label: "Verify Period", icon: Check, show: (row) => row.IS_VERIFIED === "No", onClick: (row) => run("verify", [row.PERIOD_ID], refresh) },
  ];

  return (
    <EntityListView
      list="period_mst"
      query={query}
      listActions={listActions}
      rowActions={rowActions}
      filters={
        <PeriodFilterBar
          filters={filters}
          periodTypeId={periodTypeId}
          periodStatusId={periodStatusId}
          onChange={(n) => router.push(buildPeriodUrl(n.periodTypeId, n.periodStatusId))}
        />
      }
    />
  );
}








// "use client";

// import { useCallback, useEffect, useMemo, useState } from "react";
// import { useRouter } from "next/navigation";
// import { CalendarX, Check, Lock, LockOpen, RefreshCw, Upload } from "lucide-react";
// import { toast } from "sonner";

// import SearchableSelect from "@/components/forms/SearchableSelect";
// import EntityListView, { type ListContext } from "@/components/listview/EntityListView";
// import type { ListAction } from "@/components/listview/ListViewShell";
// import type { RowAction } from "@/components/DataTable/types";
// import { authFetch } from "@/lib/auth/authFetch";
// import { SETTINGS_VERIFY_HREF } from "@/lib/periodMngt/period.registry";
// import type { PeriodActionResult, PeriodListFilters } from "@/lib/periodMngt/period.types";

// /**
//  * CI periodMngt/period_mst::index (include/listview_v + js/periodMngt/period_mst.js):
//  *  - filters (CI $customFields): Period Type (enabled types) and Period Status; changing one reloads
//  *    index/{type}/{status}. CI quirk kept: with both chosen only the type filters (see lib/periodMngt);
//  *  - header: Add New Period Master, then for admins Lock / Unlock / Verify (selected rows),
//  *    Syncronize Period, Generate the Period, Close Period (selected rows);
//  *  - rows: Edit, Delete, and Verify while the period is not verified.
//  * List data: GET /api/listview/period_mst (lib/listview/listDefinitions 'period_mst').
//  */

// type Row = Record<string, unknown>;
// type ActionName = "verify" | "lock" | "unlock" | "close" | "generate" | "sync";

// const API = "/api/periodMngt/period_mst";
// const PAGE = "/periodMngt/period_mst";

// /** CI flash messages → toasts (several at once after Generate). */
// function showMessages(r: PeriodActionResult) {
//   if (r.messages.success) toast.success(r.messages.success);
//   if (r.messages.warning) toast.warning(r.messages.warning);
//   if (r.messages.danger) toast.error(r.messages.danger);
// }

// export default function PeriodList({ periodTypeId, periodStatusId }: { periodTypeId: string; periodStatusId: string }) {
//   const router = useRouter();
//   const [filters, setFilters] = useState<PeriodListFilters | null>(null);
//   const [busy, setBusy] = useState(false);

//   useEffect(() => {
//     let cancelled = false;
//     authFetch(`${API}/filters`, { cache: "no-store" })
//       .then(async (res) => {
//         const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string; data?: PeriodListFilters } | null;
//         if (!res.ok || !json?.success || !json.data) throw new Error(json?.message ?? "Failed to load the filters.");
//         if (!cancelled) setFilters(json.data);
//       })
//       .catch((e: unknown) => !cancelled && toast.error(e instanceof Error ? e.message : "Failed to load the filters."));
//     return () => {
//       cancelled = true;
//     };
//   }, []);

//   const run = useCallback(async (action: ActionName, ids: unknown[], refresh: () => void) => {
//     setBusy(true);
//     try {
//       const res = await authFetch(`${API}/actions/${action}`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ ids }),
//       });
//       const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string; code?: string; data?: PeriodActionResult } | null;
//       if (!res.ok || !json?.success || !json.data) {
//         const message = json?.message ?? "The action failed.";
//         if (json?.code === "PERIOD_SETTINGS_NOT_VERIFIED") {
//           // CI: "Please verify period settings first. <a target='_blank'>Click here</a> to verify."
//           toast.error(message, { action: { label: "Click here to verify", onClick: () => window.open(SETTINGS_VERIFY_HREF, "_blank") } });
//         } else {
//           toast.error(message);
//         }
//         return;
//       }
//       showMessages(json.data);
//       refresh();
//     } catch {
//       toast.error("The action failed.");
//     } finally {
//       setBusy(false);
//     }
//   }, []);

//   /** CI: changing a filter reloads index/{periodTypeId}/{periodStatusId} (0 = none). */
//   const navigate = (next: { periodTypeId?: string; periodStatusId?: string }) => {
//     const p = new URLSearchParams();
//     const type = next.periodTypeId ?? periodTypeId;
//     const status = next.periodStatusId ?? periodStatusId;
//     if (type && type !== "0") p.set("periodTypeId", type);
//     if (status && status !== "0") p.set("periodStatusId", status);
//     router.push(p.toString() ? `${PAGE}?${p}` : PAGE);
//   };

//   const query = useMemo(
//     () => ({ ...(periodTypeId ? { periodTypeId } : {}), ...(periodStatusId ? { periodStatusId } : {}) }),
//     [periodTypeId, periodStatusId],
//   );

//   const ids = (rows: Row[]) => rows.map((r) => r.PERIOD_ID);

//   const listActions = ({ selected, refresh }: ListContext): ListAction[] =>
//     filters?.canManage
//       ? [
//           { key: "lock", title: "Lock Period", icon: Lock, disabled: busy, onClick: () => run("lock", ids(selected), refresh) },
//           { key: "unlock", title: "Unlock Period", icon: LockOpen, disabled: busy, onClick: () => run("unlock", ids(selected), refresh) },
//           { key: "verify", title: "Verify Period", icon: Check, disabled: busy, onClick: () => run("verify", ids(selected), refresh) },
//           { key: "sync", title: "Syncronize Period", icon: RefreshCw, disabled: busy, onClick: () => run("sync", [], refresh) },
//           { key: "generate", title: "Generate the Period", icon: Upload, disabled: busy, onClick: () => run("generate", [], refresh) },
//           {
//             key: "close",
//             title: "Close Period",
//             icon: CalendarX,
//             disabled: busy,
//             onClick: () => {
//               if (selected.length && !window.confirm(`Close ${selected.length} period(s)? Closed periods are marked ended and inactive.`)) return;
//               void run("close", ids(selected), refresh);
//             },
//           },
//         ]
//       : [];

//   // CI $actions['verify'] with cond IS_VERIFIED = 'No'.
//   const rowActions = ({ refresh }: ListContext): RowAction<Row>[] => [
//     { label: "Verify Period", icon: Check, show: (row) => row.IS_VERIFIED === "No", onClick: (row) => run("verify", [row.PERIOD_ID], refresh) },
//   ];

//   const filterControls = (
//     <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
//       <label className="grid gap-1 text-sm font-medium text-slate-700">
//         Period Type
//         <SearchableSelect
//           ariaLabel="Period Type"
//           placeholder="Select Period Type"
//           className="w-full"
//           value={periodTypeId || "0"}
//           options={(filters?.periodTypes ?? []).map((o) => ({ value: String(o.value), label: o.label }))}
//           onChange={(v) => navigate({ periodTypeId: v })}
//         />
//       </label>
//       <label className="grid gap-1 text-sm font-medium text-slate-700">
//         Period Status
//         <SearchableSelect
//           ariaLabel="Period Status"
//           placeholder="Select Period Status"
//           className="w-full"
//           value={periodStatusId || "0"}
//           options={(filters?.periodStatuses ?? []).map((o) => ({ value: String(o.value), label: o.label }))}
//           onChange={(v) => navigate({ periodStatusId: v })}
//         />
//       </label>
//     </div>
//   );

//   return <EntityListView list="period_mst" query={query} filters={filterControls} listActions={listActions} rowActions={rowActions} />;
// }