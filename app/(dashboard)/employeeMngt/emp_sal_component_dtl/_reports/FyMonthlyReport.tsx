"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Download, Loader2, Table2 } from "lucide-react";
import { toast } from "sonner";

import { PlainSelect } from "@/(dashboard)/utilities/_components/UtilityPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/auth/authFetch";

/**
 * CI emp_sal_component_dtl professionalTax / MonthlyGrossReport / MonthlyNetReport: one row per employee, one column
 * per month of a financial year, with row and month totals (new), the Employee / Financial Year filters, View, Clear
 * (back to the defaults — CI's Clear left the Gross / Net reports for another screen) and Export (.xlsx).
 * Rules: lib/payroll/reports/fyMonthly.ts.
 */
type Kind = "pt" | "gross" | "net";
type Option = { value: number; label: string };
interface Report {
  fy: { id: number; label: string };
  months: Array<{ key: string; label: string }>;
  rows: Array<{ empId: number; empCode: string | null; empName: string; cells: Record<string, string | null>; total: string }>;
  totals: { cells: Record<string, string>; total: string };
}

const FILES: Record<Kind, string> = { pt: "Professional Tax Report.xlsx", gross: "Monthly Gross Report.xlsx", net: "Monthly Net Report.xlsx" };
const SUBTITLE: Record<Kind, string> = {
  pt: "The Professional Tax line of each month's payslip.",
  gross: "Gross as per salary structure (before loss of pay; excludes incentives / arrears).",
  net: "The net pay of each month's payslip.",
};
const ALL = "0";
const grouped = (v: string | null | undefined) =>
  v === null || v === undefined || v === "" ? "" : new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v));

export default function FyMonthlyReport({ kind, title, emp: initialEmp, fy: initialFy }: { kind: Kind; title: string; emp?: string; fy?: string }) {
  const [employees, setEmployees] = useState<Option[]>([]);
  const [years, setYears] = useState<Option[] | null>(null);
  const [defaultFy, setDefaultFy] = useState<string>("");
  const [emp, setEmp] = useState(initialEmp && initialEmp !== "0" ? initialEmp : ALL);
  const [fy, setFy] = useState(initialFy && initialFy !== "0" ? initialFy : "");
  const [applied, setApplied] = useState<{ emp: string; fy: string } | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  // The query whose answer is shown (loading while it differs from the applied one).
  const [fetched, setFetched] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    authFetch(`/api/payroll/reports/options?for=${kind}`)
      .then((r) => r.json())
      .then((json: { success?: boolean; message?: string; data?: { financialYears: Option[]; defaultFy: number | null; employees: Option[]; message: string | null } }) => {
        if (!live) return;
        if (!json?.success || !json.data) {
          setYears([]);
          setMessage(json?.message ?? "You do not have access to this report.");
          return;
        }
        setYears(json.data.financialYears);
        setEmployees(json.data.employees);
        setMessage(json.data.message);
        const d = json.data.defaultFy ? String(json.data.defaultFy) : "";
        setDefaultFy(d);
        const start = { emp: initialEmp && initialEmp !== "0" ? initialEmp : ALL, fy: initialFy && initialFy !== "0" ? initialFy : d };
        setFy(start.fy);
        if (start.fy) setApplied(start);
      })
      .catch(() => live && setYears([]));
    return () => {
      live = false;
    };
  }, [kind, initialEmp, initialFy]);

  const query = useCallback((a: { emp: string; fy: string }) => new URLSearchParams({ fy: a.fy, ...(a.emp !== ALL ? { emp: a.emp } : {}) }).toString(), []);

  const appliedKey = applied ? query(applied) : null;
  const loading = appliedKey !== null && fetched !== appliedKey;

  useEffect(() => {
    if (!appliedKey) return;
    let live = true;
    authFetch(`/api/payroll/reports/${kind}?${appliedKey}`)
      .then((r) => r.json())
      .then((json: { success?: boolean; message?: string; data?: Report }) => {
        if (!live) return;
        if (!json?.success || !json.data) throw new Error(json?.message ?? "The report could not be loaded.");
        setReport(json.data);
      })
      .catch((e: unknown) => {
        if (!live) return;
        setReport(null);
        toast.error(e instanceof Error ? e.message : "The report could not be loaded.");
      })
      .finally(() => live && setFetched(appliedKey));
    window.history.replaceState(null, "", `?${appliedKey}`);
    return () => {
      live = false;
    };
  }, [appliedKey, kind]);

  const view = () => {
    if (!fy) {
      toast.error("The Financial Year field is required.");
      return;
    }
    setApplied({ emp, fy });
  };
  const clear = () => {
    setEmp(ALL);
    setFy(defaultFy);
    setSearch("");
    if (defaultFy) setApplied({ emp: ALL, fy: defaultFy });
  };
  const exportFile = async () => {
    if (!applied) return;
    setExporting(true);
    try {
      const res = await authFetch(`/api/payroll/reports/${kind}/export?${query(applied)}`);
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(json?.message ?? "The file could not be made.");
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = FILES[kind];
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The file could not be made.");
    } finally {
      setExporting(false);
    }
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!report) return [];
    return q ? report.rows.filter((r) => `${r.empCode ?? ""} ${r.empName}`.toLowerCase().includes(q)) : report.rows;
  }, [report, search]);

  const card = "rounded-3xl border bg-white p-4 shadow-sm brand:border-slate-200 dark:border-white/10 dark:bg-[#111a2e]";
  return (
    <div className="space-y-4 p-4">
      <div className={card}>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-[#9aa4b8]">
          <span>Payroll</span>
          <ChevronRight size={15} className="text-slate-400" />
          <span className="font-semibold text-blue-600">{title}</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Table2 className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-[#e6e9ef]">{title}</h1>
        </div>
        <p className="mt-1 text-xs text-slate-500">{SUBTITLE[kind]}</p>
      </div>

      {message ? <p className="px-2 text-sm text-red-500">{message}</p> : null}

      <div className={`${card} grid grid-cols-1 items-end gap-4 md:grid-cols-4`}>
        <PlainSelect
          id={`${kind}Emp`}
          label="Employee"
          value={emp}
          onChange={setEmp}
          options={[{ value: ALL, label: "All employees" }, ...employees.map((e) => ({ value: String(e.value), label: e.label }))]}
        />
        <PlainSelect
          id={`${kind}Fy`}
          label="Financial Year"
          value={fy}
          onChange={setFy}
          disabled={years === null}
          options={(years ?? []).map((y) => ({ value: String(y.value), label: y.label }))}
        />
        <div className="flex gap-2 md:col-span-2">
          <Button onClick={view} disabled={loading || years === null}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            View
          </Button>
          <Button variant="outline" onClick={clear} disabled={loading}>
            Clear
          </Button>
          <Button variant="outline" onClick={exportFile} disabled={!report || exporting}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export
          </Button>
        </div>
      </div>

      <div className={card}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600 dark:text-[#c3cad6]">
            {report ? `${report.fy.label} · ${report.rows.length} employee(s)` : years !== null && !years.length ? "No financial year is set up for this brand." : ""}
          </p>
          <Input className="h-8 w-56" placeholder="Search employee..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-[#e15425]/40 bg-[#fbe6dd] text-left text-[12px] text-[#b4441f] dark:border-[#da5427]/50 dark:bg-[#da5427]/15 dark:text-[#f8a27e]">
                <th className="sticky left-0 z-10 bg-[#fbe6dd] px-2 py-2 font-semibold dark:bg-[#2a1f22]">Employee Code</th>
                <th className="px-2 py-2 font-semibold">Employee Name</th>
                {report?.months.map((m) => (
                  <th key={m.key} className="whitespace-nowrap px-2 py-2 text-right font-semibold">
                    {m.label}
                  </th>
                ))}
                <th className="px-2 py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.empId} className="border-b border-slate-100 transition-[background-color,box-shadow] duration-150 hover:bg-[#fdf3ee] hover:shadow-[inset_3px_0_0_#e15425] dark:border-white/5 dark:hover:bg-[#16233d] dark:hover:shadow-[inset_3px_0_0_#f8a27e]">
                  <td className="sticky left-0 bg-white px-2 py-1.5 dark:bg-[#111a2e]">{r.empCode ?? ""}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{r.empName}</td>
                  {report?.months.map((m) => (
                    <td key={m.key} className="px-2 py-1.5 text-right tabular-nums">
                      {grouped(r.cells[m.key])}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{grouped(r.total)}</td>
                </tr>
              ))}
              {report && !rows.length ? (
                <tr>
                  <td colSpan={(report.months.length ?? 0) + 3} className="px-2 py-6 text-center text-slate-500">
                    No records found.
                  </td>
                </tr>
              ) : null}
            </tbody>
            {report && report.rows.length ? (
              <tfoot>
                <tr className="border-t-2 border-slate-300 font-semibold dark:border-white/20">
                  <td className="sticky left-0 bg-white px-2 py-2 dark:bg-[#111a2e]" />
                  <td className="px-2 py-2">Total</td>
                  {report.months.map((m) => (
                    <td key={m.key} className="px-2 py-2 text-right tabular-nums">
                      {grouped(report.totals.cells[m.key])}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right tabular-nums">{grouped(report.totals.total)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
    </div>
  );
}
