"use client";

import { useMemo, useState } from "react";
import { Eye } from "lucide-react";

import { PlainSelect } from "@/(dashboard)/utilities/_components/UtilityPage";
import type { RowAction } from "@/components/DataTable/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentSession } from "@/lib/header/HeaderSessionContext";
import HubList, { type HubRow } from "../_hub/HubList";
import { STATUSES } from "../emp_sal_component_mst/_annexure/annexureActions";
import { currentMonth } from "../emp_sal_component_mst/_payslip/payslipActions";

/**
 * CI employeeMngt/emp_sal_component_dtl ("Component Wise Salary Breakup"): the payslip lines of a month (current month
 * first; empty box: every month), current employees unless another status is chosen. Rules:
 * lib/employeeMngt/hub/screens/salary_components.ts.
 */
const MONTH_YEAR = /^(0?[1-9]|1[0-2])\/\d{4}$/;
const rowActions: RowAction<HubRow>[] = [
  { label: "View Payslip", icon: Eye, onClick: (r) => window.open(`/api/payroll/payslips/${r.PAYSLIP_ID}/document`, "_blank", "noopener") },
];

export default function SalaryComponentsList({ emp }: { emp?: string }) {
  const session = useCurrentSession();
  const admin = (session?.userLevel ?? 0) > 0;
  const [status, setStatus] = useState("EMSC");
  const [monthYear, setMonthYear] = useState(currentMonth);
  const applied = MONTH_YEAR.test(monthYear.trim()) ? monthYear.trim() : "";
  const filters = useMemo(
    () => ({ status: admin ? status : "all", ...(applied ? { monthYear: applied } : {}) }),
    [admin, status, applied],
  );

  return (
    <HubList
      screen="salary_components"
      emp={emp}
      filters={filters}
      toolbar={() => (
        <div className="grid grid-cols-1 items-end gap-4 rounded-3xl border bg-white p-4 shadow-sm brand:border-slate-200 md:grid-cols-3 dark:border-white/10 dark:bg-[#111a2e]">
          {admin ? <PlainSelect id="scStatus" label="Employment Status" value={status} onChange={setStatus} options={STATUSES} /> : null}
          <div className="space-y-1.5">
            <Label htmlFor="scMonth" className="text-sm font-medium text-slate-700 dark:text-[#d5dae4]">
              Month / Year
            </Label>
            <Input id="scMonth" className="h-9" placeholder="MM/YYYY (empty: every month)" value={monthYear} onChange={(e) => setMonthYear(e.target.value)} />
          </div>
        </div>
      )}
      rowActions={rowActions}
    />
  );
}
