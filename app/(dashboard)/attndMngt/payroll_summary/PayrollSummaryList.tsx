"use client";

import { useMemo, useState } from "react";

import { PlainSelect } from "@/(dashboard)/utilities/_components/UtilityPage";
import HubList from "../../employeeMngt/_hub/HubList";

/**
 * CI attndMngt/payroll_summary list with its customFields: the month (and, new, the year) to list —
 * CI's month filter showed that month of every year. Rules: lib/employeeMngt/hub/screens/payroll_summary.ts.
 */
const ANY = "0";
const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: new Date(Date.UTC(2000, i, 1)).toLocaleString("en-GB", { month: "long", timeZone: "UTC" }),
}));

export default function PayrollSummaryList({ emp }: { emp?: string }) {
  const [month, setMonth] = useState(ANY);
  const [year, setYear] = useState(ANY);
  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: now - 2018 }, (_, i) => ({ value: String(now - i), label: String(now - i) }));
  }, []);
  const filters = useMemo(() => ({ ...(month !== ANY ? { month } : {}), ...(year !== ANY ? { year } : {}) }), [month, year]);

  return (
    <HubList
      screen="payroll_summary"
      emp={emp}
      filters={filters}
      toolbar={() => (
        <div className="grid grid-cols-1 gap-4 rounded-3xl border bg-white p-4 shadow-sm brand:border-slate-200 md:grid-cols-3 dark:border-white/10 dark:bg-[#111a2e]">
          <PlainSelect id="summaryMonth" label="Calendar Month" value={month} onChange={setMonth} options={[{ value: ANY, label: "All months" }, ...MONTHS]} />
          <PlainSelect id="summaryYear" label="Calendar Year" value={year} onChange={setYear} options={[{ value: ANY, label: "All years" }, ...years]} />
        </div>
      )}
    />
  );
}
