"use client";

import { useEffect, useMemo, useState } from "react";
import { Boxes, CheckSquare } from "lucide-react";
import { toast } from "sonner";

import { PlainSelect } from "@/(dashboard)/utilities/_components/UtilityPage";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authFetch } from "@/lib/auth/authFetch";
import { useCurrentSession } from "@/lib/header/HeaderSessionContext";
import HubList, { type HubRow } from "../../_hub/HubList";
import { STATUSES, documentActions } from "../_annexure/annexureActions";
import GenerateAnnexureDialog, {
  type AnnexureOptions,
} from "./GenerateAnnexureDialog";

/**
 * CI employeeMngt/emp_sal_component_mst/indexAnnexures (admins): every annexure header of the brand — filters,
 * "Mark Current Annexure" on the selected rows, the PDF, delete (the whole annexure).
 * Rules: lib/employeeMngt/hub/screens/annexures.ts, lib/payroll/annexure/*.
 */
const ANY = "any";
const FREQUENCIES = [
  { value: ANY, label: "Both" },
  { value: "yearly", label: "Yearly" },
  { value: "period", label: "Pay frequency" },
];
const MONTH_YEAR = /^(0?[1-9]|1[0-2])\/\d{4}$/;

export default function AnnexureProcessingList({ emp }: { emp?: string }) {
  const session = useCurrentSession();
  const [status, setStatus] = useState("EMSC");
  const [frequency, setFrequency] = useState(ANY);
  const [current, setCurrent] = useState(false);
  const [monthYear, setMonthYear] = useState("");
  const [options, setOptions] = useState<AnnexureOptions | null>(null);
  const [generating, setGenerating] = useState<{ refresh: () => void } | null>(
    null,
  );
  const applied = MONTH_YEAR.test(monthYear.trim()) ? monthYear.trim() : "";
  const filters = useMemo(
    () => ({
      status,
      ...(frequency !== ANY ? { frequency } : {}),
      ...(current ? { current: "1" } : {}),
      ...(applied ? { monthYear: applied } : {}),
    }),
    [status, frequency, current, applied],
  );

  useEffect(() => {
    let cancelled = false;
    authFetch("/api/payroll/annexures/options")
      .then((res) => res.json())
      .then(
        (json) =>
          !cancelled &&
          json.success &&
          setOptions(json.data as AnnexureOptions),
      )
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // CI refused normal users (EMTSI00001).
  if (session && session.userLevel === 0) {
    return (
      <p className="p-6 text-sm text-red-500">
        Access Denied You do not have sufficient rights to perform this
        operation please contact your Business administrator for change in your
        access permissions
      </p>
    );
  }

  const markCurrent = async (rows: HubRow[], refresh: () => void) => {
    try {
      const res = await authFetch("/api/payroll/annexures/current", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: rows.map((r) => r.id) }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
        errors?: Record<string, string[]>;
      } | null;
      if (!res.ok || !json?.success)
        throw new Error(
          Object.values(json?.errors ?? {})[0]?.[0] ??
            json?.message ??
            "The request failed.",
        );
      toast.success(json.message ?? "Done.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The request failed.");
    }
  };

  return (
    <>
      <HubList
        screen="annexure_processing"
        emp={emp}
        filters={filters}
        toolbar={() => (
          <div className="grid grid-cols-1 items-end gap-4 rounded-3xl border bg-white p-4 shadow-sm brand:border-slate-200 md:grid-cols-4 dark:border-white/10 dark:bg-[#111a2e]">
            <PlainSelect
              id="annexStatus"
              label="Employment Status"
              value={status}
              onChange={setStatus}
              options={STATUSES}
            />
            <PlainSelect
              id="annexFrequency"
              label="Pay Frequency"
              value={frequency}
              onChange={setFrequency}
              options={FREQUENCIES}
            />
            <div className="space-y-1.5">
              <Label
                htmlFor="annexMonth"
                className="text-sm font-medium text-slate-700 dark:text-[#d5dae4]"
              >
                Month / Year
              </Label>
              <Input
                id="annexMonth"
                className="h-9"
                placeholder="MM/YYYY"
                value={monthYear}
                onChange={(e) => setMonthYear(e.target.value)}
              />
            </div>
            <label className="flex h-9 items-center gap-2 text-sm text-slate-700 dark:text-[#d5dae4]">
              <Checkbox
                checked={current}
                onCheckedChange={(v) => setCurrent(v === true)}
              />
              Current annexures only
            </label>
          </div>
        )}
        listActions={({ refresh }) =>
          options?.permissions.generate
            ? [
                {
                  key: "generate",
                  title: "Generate Salary Annexure",
                  icon: Boxes,
                  onClick: () => setGenerating({ refresh }),
                },
              ]
            : []
        }
        bulkActions={({ refresh }) =>
          options?.permissions.markCurrent
            ? [
                {
                  label: "Mark Current Annexure",
                  icon: CheckSquare,
                  onClick: (rows) => markCurrent(rows, refresh),
                },
              ]
            : []
        }
        rowActions={documentActions}
      />
      {options && generating ? (
        <GenerateAnnexureDialog
          open
          options={options}
          emp={emp}
          onClose={() => setGenerating(null)}
          onDone={generating.refresh}
        />
      ) : null}
    </>
  );
}
