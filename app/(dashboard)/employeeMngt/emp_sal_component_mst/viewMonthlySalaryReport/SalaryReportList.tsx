"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileSpreadsheet, XCircle } from "lucide-react";
import { toast } from "sonner";

import { PlainSelect } from "@/(dashboard)/utilities/_components/UtilityPage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authFetch } from "@/lib/auth/authFetch";
import HubList, { type HubRow } from "../../_hub/HubList";
import { STATUSES } from "../_annexure/annexureActions";
import { currentMonth, payslipActions } from "../_payslip/payslipActions";

/**
 * CI employeeMngt/emp_sal_component_mst/viewMonthlySalaryReport ("Salary Report" — Salary Bank Transfer Report): one
 * month's payslips with the bank account and the payable amount, Mark as Paid / Unpaid, and the bank's bulk-payment file.
 * Rules: lib/employeeMngt/hub/screens/salary_report.ts, lib/payroll/salaryReport/bankTransfer.ts.
 */
const ANY = "any";
const PAID = [
  { value: ANY, label: "All" },
  { value: "1", label: "Paid" },
  { value: "0", label: "Unpaid" },
];
const MONTH_YEAR = /^(0?[1-9]|1[0-2])\/\d{4}$/;

export default function SalaryReportList({ emp }: { emp?: string }) {
  const [status, setStatus] = useState("EMSC");
  const [monthYear, setMonthYear] = useState(currentMonth);
  const [paid, setPaid] = useState(ANY);
  const [perms, setPerms] = useState<{ markPaid: boolean; bankFile: boolean } | null>(null);
  // The report is always one month: an empty or invalid box means the current month (CI).
  const applied = MONTH_YEAR.test(monthYear.trim()) ? monthYear.trim().padStart(7, "0") : currentMonth();
  const filters = useMemo(() => ({ status, monthYear: applied, ...(paid !== ANY ? { paid } : {}) }), [status, applied, paid]);

  useEffect(() => {
    let live = true;
    authFetch("/api/payroll/salary-report/options")
      .then((r) => r.json())
      .then((json: { success?: boolean; data?: { permissions: { markPaid: boolean; bankFile: boolean } } }) => {
        if (live && json?.success && json.data) setPerms(json.data.permissions);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const mark = async (rows: HubRow[], value: boolean, refresh: () => void) => {
    if (!value && !window.confirm("The employees will no longer see these payslips in My Payslips.")) return;
    try {
      const res = await authFetch("/api/payroll/payslips/paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: rows.map((r) => r.id), paid: value, menu: "salary_report" }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
      if (!res.ok || !json?.success) throw new Error(json?.message ?? "The request failed.");
      toast.success(json.message ?? "Done.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The request failed.");
    }
  };

  const bankFile = async () => {
    const q = new URLSearchParams({ monthYear: applied, ...(emp ? { emp } : {}), ...(paid !== ANY ? { paid } : {}) });
    try {
      const res = await authFetch(`/api/payroll/salary-report/bank-transfer?${q.toString()}`);
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(json?.message ?? "The file could not be made.");
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "Salary Bank Transfer Report.xlsx";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const excluded = JSON.parse(res.headers.get("X-Excluded") ?? "{}") as { noAccount?: string[]; notPositive?: string[] };
      const parts = [
        excluded.noAccount?.length ? `no bank account: ${excluded.noAccount.join(", ")}` : "",
        excluded.notPositive?.length ? `net pay 0 or less: ${excluded.notPositive.join(", ")}` : "",
      ].filter(Boolean);
      const n = (excluded.noAccount?.length ?? 0) + (excluded.notPositive?.length ?? 0);
      if (n) toast.warning(`${n} payslip(s) not in the file — ${parts.join("; ")}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The file could not be made.");
    }
  };

  return (
    <HubList
      screen="salary_report"
      emp={emp}
      filters={filters}
      toolbar={() => (
        <div className="space-y-2">
          <div className="grid grid-cols-1 items-end gap-4 rounded-3xl border bg-white p-4 shadow-sm brand:border-slate-200 md:grid-cols-3 dark:border-white/10 dark:bg-[#111a2e]">
            <PlainSelect id="srStatus" label="Employment Status" value={status} onChange={setStatus} options={STATUSES} />
            <div className="space-y-1.5">
              <Label htmlFor="srMonth" className="text-sm font-medium text-slate-700 dark:text-[#d5dae4]">
                Month / Year
              </Label>
              <Input id="srMonth" className="h-9" placeholder="MM/YYYY" value={monthYear} onChange={(e) => setMonthYear(e.target.value)} />
            </div>
            <PlainSelect id="srPaid" label="Transaction Status" value={paid} onChange={setPaid} options={PAID} />
          </div>
          {perms?.bankFile ? <p className="px-2 text-xs text-slate-500">The bank file includes every employment status.</p> : null}
        </div>
      )}
      listActions={() =>
        perms?.bankFile ? [{ key: "bank-file", title: "Salary Bank Transfer Report", icon: FileSpreadsheet, onClick: bankFile }] : []
      }
      bulkActions={({ refresh }) =>
        perms?.markPaid
          ? [
              { label: "Mark as Paid", icon: CheckCircle2, onClick: (rows) => mark(rows, true, refresh) },
              { label: "Mark as Unpaid", icon: XCircle, onClick: (rows) => mark(rows, false, refresh) },
            ]
          : []
      }
      rowActions={payslipActions}
    />
  );
}
