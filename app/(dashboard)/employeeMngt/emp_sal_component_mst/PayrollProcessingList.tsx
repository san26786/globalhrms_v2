"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { PlainSelect } from "@/(dashboard)/utilities/_components/UtilityPage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authFetch } from "@/lib/auth/authFetch";
import { useCurrentSession } from "@/lib/header/HeaderSessionContext";
import HubList, { type HubRow } from "../_hub/HubList";
import { STATUSES } from "./_annexure/annexureActions";
import GenerateSalaryDialog, { type PayrollOptions } from "./_payslip/GenerateSalaryDialog";
import { currentMonth, payslipActions } from "./_payslip/payslipActions";

/**
 * CI employeeMngt/emp_sal_component_mst (Payroll Processing, admins): the brand's payslips of a month (the current
 * month first, current employees unless another status is chosen), Generate Salary, Mark as Paid / Unpaid on the
 * selected rows, delete (unpaid, latest of the year) and the payslip PDF. Rules: lib/employeeMngt/hub/screens/payslips.ts,
 * lib/payroll/run/*, lib/payroll/payslip/*.
 */
const ANY = "any";
const PAID = [
  { value: ANY, label: "All" },
  { value: "1", label: "Paid" },
  { value: "0", label: "Unpaid" },
];
const MONTH_YEAR = /^(0?[1-9]|1[0-2])\/\d{4}$/;

export default function PayrollProcessingList({ emp }: { emp?: string }) {
  const session = useCurrentSession();
  const [status, setStatus] = useState("EMSC");
  const [monthYear, setMonthYear] = useState(currentMonth);
  const [paid, setPaid] = useState(ANY);
  const [options, setOptions] = useState<PayrollOptions | null>(null);
  const [generating, setGenerating] = useState<{ refresh: () => void } | null>(null);
  const applied = MONTH_YEAR.test(monthYear.trim()) ? monthYear.trim() : "";
  const filters = useMemo(
    () => ({ status, ...(applied ? { monthYear: applied } : {}), ...(paid !== ANY ? { paid } : {}) }),
    [status, applied, paid],
  );
  const admin = !!session && session.userLevel > 0;

  useEffect(() => {
    if (!admin) return;
    let live = true;
    authFetch("/api/payroll/payslips/options")
      .then((r) => r.json())
      .then((json: { success?: boolean; data?: PayrollOptions }) => {
        if (live && json?.success && json.data) setOptions(json.data);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [admin]);

  // CI sent normal users back to the dashboard.
  if (session && session.userLevel === 0) {
    return (
      <p className="p-6 text-sm text-red-500">
        Access Denied You do not have sufficient rights to perform this operation please contact your Business administrator for change in your access permissions
      </p>
    );
  }

  const mark = async (rows: HubRow[], value: boolean, refresh: () => void) => {
    if (!value && !window.confirm("The employees will no longer see these payslips in My Payslips.")) return;
    try {
      const res = await authFetch("/api/payroll/payslips/paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: rows.map((r) => r.id), paid: value }),
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
    <>
      <HubList
        screen="payroll_processing"
        emp={emp}
        filters={filters}
        toolbar={() => (
          <div className="grid grid-cols-1 items-end gap-4 rounded-3xl border bg-white p-4 shadow-sm brand:border-slate-200 md:grid-cols-3 dark:border-white/10 dark:bg-[#111a2e]">
            <PlainSelect id="payStatus" label="Employment Status" value={status} onChange={setStatus} options={STATUSES} />
            <div className="space-y-1.5">
              <Label htmlFor="payMonth" className="text-sm font-medium text-slate-700 dark:text-[#d5dae4]">
                Month / Year
              </Label>
              <Input id="payMonth" className="h-9" placeholder="MM/YYYY (empty: every month)" value={monthYear} onChange={(e) => setMonthYear(e.target.value)} />
            </div>
            <PlainSelect id="payPaid" label="Transaction Status" value={paid} onChange={setPaid} options={PAID} />
          </div>
        )}
        listActions={({ refresh }) =>
          options?.permissions.generate ? [{ key: "generate", title: "Generate Salary", icon: Banknote, onClick: () => setGenerating({ refresh }) }] : []
        }
        bulkActions={({ refresh }) =>
          options?.permissions.markPaid
            ? [
                { label: "Mark as Paid", icon: CheckCircle2, onClick: (rows) => mark(rows, true, refresh) },
                { label: "Mark as Unpaid", icon: XCircle, onClick: (rows) => mark(rows, false, refresh) },
              ]
            : []
        }
        rowActions={payslipActions}
      />
      {options && generating ? (
        <GenerateSalaryDialog options={options} emp={emp} monthYear={applied || undefined} onClose={() => setGenerating(null)} onDone={generating.refresh} />
      ) : null}
    </>
  );
}
