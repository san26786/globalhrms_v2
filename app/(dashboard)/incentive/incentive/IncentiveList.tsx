"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { PlainSelect } from "@/(dashboard)/utilities/_components/UtilityPage";
import { authFetch } from "@/lib/auth/authFetch";
import { useCurrentSession } from "@/lib/header/HeaderSessionContext";
import HubList, { type HubRow } from "../../employeeMngt/_hub/HubList";

/**
 * CI incentive/incentive list: incentives and arrears, current employees unless another employment status
 * is chosen (admins), and CI's "Mark As Paid" / "Mark As Unpaid" on the selected rows.
 * Rules: lib/employeeMngt/hub/screens/incentive.ts, lib/payroll/incentive.ts.
 */
const STATUSES = [
  { value: "EMSC", label: "Current" },
  { value: "EMSF", label: "Former" },
  { value: "all", label: "All employees" },
];
const ANY = "any";
const TYPES = [
  { value: ANY, label: "All types" },
  { value: "MACINCEN", label: "Incentive" },
  { value: "MACINARR", label: "Arrears" },
];

export default function IncentiveList({ emp }: { emp?: string }) {
  const session = useCurrentSession();
  const admin = (session?.userLevel ?? 0) > 0;
  const [status, setStatus] = useState("EMSC");
  const [type, setType] = useState(ANY);
  const filters = useMemo(() => ({ status, ...(type !== ANY ? { type } : {}) }), [status, type]);

  const mark = async (rows: HubRow[], paid: boolean, refresh: () => void) => {
    try {
      const res = await authFetch("/api/employeeMngt/incentive/paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: rows.map((r) => r.id), paid }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
      if (!res.ok || !json?.success) throw new Error(json?.message ?? "The request failed.");
      toast.success(json.message ?? "Done.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The request failed.");
    }
  };

  return (
    <HubList
      screen="incentive"
      emp={emp}
      filters={filters}
      toolbar={
        admin
          ? () => (
              <div className="grid grid-cols-1 gap-4 rounded-3xl border bg-white p-4 shadow-sm brand:border-slate-200 md:grid-cols-3 dark:border-white/10 dark:bg-[#111a2e]">
                <PlainSelect id="incentiveStatus" label="Employment Status" value={status} onChange={setStatus} options={STATUSES} />
                <PlainSelect id="incentiveType" label="Type" value={type} onChange={setType} options={TYPES} />
              </div>
            )
          : undefined
      }
      bulkActions={({ refresh, permissions }) =>
        admin && permissions.update
          ? [
              { label: "Mark As Paid", icon: CheckCircle2, onClick: (rows) => mark(rows, true, refresh) },
              { label: "Mark As Unpaid", icon: XCircle, onClick: (rows) => mark(rows, false, refresh) },
            ]
          : []
      }
    />
  );
}
