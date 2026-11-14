"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PlainSelect } from "@/(dashboard)/utilities/_components/UtilityPage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { authFetch } from "@/lib/auth/authFetch";
import { useCurrentSession } from "@/lib/header/HeaderSessionContext";
import HubList from "../../_hub/HubList";

/**
 * CI employeeMngt/emp_sal_component_dtl/SalaryBreakUp ("Salary Breakup"): each employee's salary breakup of a financial
 * year (default the current one; "All years"), and for admins CI's two exports: "Generate Tax Breakup" (each employee's
 * declarations, taxable income and tax — CI emp_investment_declarations::exportTaxBreakup) and "Generate Monthly Tax
 * Deduction" (the year's income tax per month), .xlsx. Rules: lib/employeeMngt/hub/screens/salary_breakup.ts,
 * lib/payroll/declarations/taxBreakup.ts, lib/payroll/reports/monthlyTax.ts.
 */
const ALL = "all";
type Option = { value: number; label: string };

/** CI's two export dialogs: endpoint, file name and title. */
const EXPORTS = {
  tax: { url: "/api/payroll/reports/tax-breakup", file: "Tax Breakup Report.xlsx", title: "Export Tax Breakup" },
  monthly: { url: "/api/payroll/reports/monthly-tax", file: "Monthly Tax Deducation Report.xlsx", title: "Export Monthly Tax Deduction" },
} as const;

export default function SalaryBreakupList({ emp }: { emp?: string }) {
  const session = useCurrentSession();
  const admin = (session?.userLevel ?? 0) > 0;
  const [years, setYears] = useState<Option[] | null>(null);
  const [fy, setFy] = useState<string>(ALL);
  const [dialog, setDialog] = useState<keyof typeof EXPORTS | null>(null);
  const [taxFy, setTaxFy] = useState("");
  const [busy, setBusy] = useState(false);
  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    if (fy !== ALL) f.fy = fy;
    return f;
  }, [fy]);

  useEffect(() => {
    let live = true;
    authFetch("/api/payroll/reports/options?for=breakup")
      .then((r) => r.json())
      .then((json: { success?: boolean; data?: { financialYears: Option[]; defaultFy: number | null } }) => {
        if (!live || !json?.success || !json.data) return;
        setYears(json.data.financialYears);
        if (json.data.defaultFy) setFy(String(json.data.defaultFy));
      })
      .catch(() => live && setYears([]));
    return () => {
      live = false;
    };
  }, []);

  const generate = async () => {
    if (!taxFy) {
      toast.error("The Financial Year field is required.");
      return;
    }
    setBusy(true);
    try {
      if (!dialog) return;
      const res = await authFetch(`${EXPORTS[dialog].url}?fy=${encodeURIComponent(taxFy)}`);
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(json?.message ?? "The file could not be made.");
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = EXPORTS[dialog].file;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDialog(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The file could not be made.");
    } finally {
      setBusy(false);
    }
  };

  const options = [{ value: ALL, label: "All years" }, ...(years ?? []).map((y) => ({ value: String(y.value), label: y.label }))];

  return (
    <>
      {years === null ? <p className="p-6 text-sm text-slate-500">Loading…</p> : null}
      {years !== null ? <HubList
        screen="salary_breakup"
        emp={emp}
        filters={filters}
        toolbar={() => (
          <div className="grid grid-cols-1 items-end gap-4 rounded-3xl border bg-white p-4 shadow-sm brand:border-slate-200 md:grid-cols-2 dark:border-white/10 dark:bg-[#111a2e]">
            <PlainSelect id="sbYear" label="Financial Year" value={fy} onChange={setFy} options={options} disabled={years === null} />
          </div>
        )}
        listActions={() =>
          admin && years?.length
            ? [
                { key: "tax-breakup", title: "Generate Tax Breakup", icon: Calculator, onClick: () => { setTaxFy(fy !== ALL ? fy : String(years[0].value)); setDialog("tax"); } },
                { key: "monthly-tax", title: "Generate Monthly Tax Deduction", icon: FileSpreadsheet, onClick: () => { setTaxFy(fy !== ALL ? fy : String(years[0].value)); setDialog("monthly"); } },
              ]
            : []
        }
      /> : null}
      {dialog ? (
        <Dialog open onOpenChange={(v) => !v && !busy && setDialog(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{EXPORTS[dialog].title}</DialogTitle>
            </DialogHeader>
            <PlainSelect id="taxYear" label="Financial Year" value={taxFy} onChange={setTaxFy} options={(years ?? []).map((y) => ({ value: String(y.value), label: y.label }))} />
            <DialogFooter className="gap-2">
              <Button variant="outline" disabled={busy} onClick={() => setDialog(null)}>
                Close
              </Button>
              <Button disabled={busy} onClick={generate}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
