"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Landmark, PiggyBank, UserRound } from "lucide-react";

import { PlainSelect } from "@/(dashboard)/utilities/_components/UtilityPage";
import { Checkbox } from "@/components/ui/checkbox";
import HubList, { type HubRow } from "../_hub/HubList";

/**
 * CI employeeMngt/emp_hrprocess list (Payroll → Employee Details): current employees unless another status is
 * chosen, optionally only those missing payroll details. Edit opens Job Detail; the row menu opens the
 * employee's personal details, bank accounts and investment details. Rules: lib/employeeMngt/hub/screens/emp_hrprocess.ts.
 */
const STATUSES = [
  { value: "EMSC", label: "Current" },
  { value: "EMSF", label: "Former" },
  { value: "all", label: "All employees" },
];

export default function EmployeeDetailsList({ emp }: { emp?: string }) {
  const router = useRouter();
  const [status, setStatus] = useState("EMSC");
  const [missing, setMissing] = useState(false);
  const filters = useMemo(() => ({ status, ...(missing ? { missing: "1" } : {}) }), [status, missing]);
  const open = (path: (r: HubRow) => string) => (r: HubRow) => router.push(path(r));

  return (
    <HubList
      screen="emp_hrprocess"
      emp={emp}
      filters={filters}
      toolbar={() => (
        <div className="grid grid-cols-1 items-end gap-4 rounded-3xl border bg-white p-4 shadow-sm brand:border-slate-200 md:grid-cols-3 dark:border-white/10 dark:bg-[#111a2e]">
          <PlainSelect id="hrStatus" label="Employee Status" value={status} onChange={setStatus} options={STATUSES} />
          <label className="flex h-9 items-center gap-2 text-sm text-slate-700 dark:text-[#d5dae4]">
            <Checkbox checked={missing} onCheckedChange={(v) => setMissing(v === true)} />
            Only employees with missing payroll details
          </label>
        </div>
      )}
      rowActions={[
        { label: "Personal Details", icon: UserRound, onClick: open((r) => `/employeeMngt/emp_mst/edit/${r.EMPLOYEE_ID}`) },
        { label: "Bank Accounts", icon: Landmark, onClick: open((r) => `/employeeMngt/bank_dtl?emp=${r.EMPLOYEE_ID}`) },
        { label: "Investment Details", icon: PiggyBank, onClick: open((r) => `/employeeMngt/emp_investments?emp=${r.EMPLOYEE_ID}`) },
      ]}
    />
  );
}
