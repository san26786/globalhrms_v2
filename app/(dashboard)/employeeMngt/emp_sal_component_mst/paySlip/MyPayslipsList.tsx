"use client";

import { useMemo, useState } from "react";

import { PlainSelect } from "@/(dashboard)/utilities/_components/UtilityPage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentSession } from "@/lib/header/HeaderSessionContext";
import HubList from "../../_hub/HubList";
import { STATUSES } from "../_annexure/annexureActions";
import { payslipActions } from "../_payslip/payslipActions";

/**
 * CI employeeMngt/emp_sal_component_mst/paySlip (My Payslips): the paid payslips the caller may see (a normal user:
 * their own), every month unless one is chosen, and their PDFs. Admins also filter by employment status.
 * Rules: lib/employeeMngt/hub/screens/payslips.ts.
 */
const ANY = "any";
const MONTH_YEAR = /^(0?[1-9]|1[0-2])\/\d{4}$/;

export default function MyPayslipsList({ emp }: { emp?: string }) {
  const session = useCurrentSession();
  const admin = (session?.userLevel ?? 0) > 0 && !emp;
  const [status, setStatus] = useState(ANY);
  const [monthYear, setMonthYear] = useState("");
  const applied = MONTH_YEAR.test(monthYear.trim()) ? monthYear.trim() : "";
  const filters = useMemo(
    () => ({ ...(admin && status !== ANY ? { status } : {}), ...(applied ? { monthYear: applied } : {}) }),
    [admin, status, applied],
  );

  return (
    <HubList
      screen="my_payslips"
      emp={emp}
      filters={filters}
      toolbar={() => (
        <div className="grid grid-cols-1 items-end gap-4 rounded-3xl border bg-white p-4 shadow-sm brand:border-slate-200 md:grid-cols-3 dark:border-white/10 dark:bg-[#111a2e]">
          <div className="space-y-1.5">
            <Label htmlFor="myPayMonth" className="text-sm font-medium text-slate-700 dark:text-[#d5dae4]">
              Month / Year
            </Label>
            <Input id="myPayMonth" className="h-9" placeholder="MM/YYYY (empty: every month)" value={monthYear} onChange={(e) => setMonthYear(e.target.value)} />
          </div>
          {admin ? (
            <PlainSelect id="myPayStatus" label="Employment Status" value={status} onChange={setStatus} options={[{ value: ANY, label: "Any status" }, ...STATUSES.filter((s) => s.value !== "all")]} />
          ) : null}
        </div>
      )}
      rowActions={payslipActions}
    />
  );
}
