"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PlainSelect } from "@/(dashboard)/utilities/_components/UtilityPage";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authFetch } from "@/lib/auth/authFetch";

/**
 * CI Annexure Processing's "Generate Salary Annexure" modal: one employee or every employee with a job salary,
 * the annexure month, the effective date, whether it becomes the current annexure (the one payroll pays from)
 * and, when the brand has a gratuity component, whether to calculate gratuity. Rules: lib/payroll/annexure/generate.ts.
 */
export interface AnnexureOptions {
  employees: Array<{ value: number; label: string }>;
  showGratuity: boolean;
  defaults: { monthYear: string };
  permissions: { generate: boolean; markCurrent: boolean };
  message: string | null;
}

interface Result {
  empId: number;
  name: string;
  status: "generated" | "skipped";
  message: string;
}

const ALL = "all";
const MONTH_YEAR = /^(0?[1-9]|1[0-2])\/\d{4}$/;

export default function GenerateAnnexureDialog({
  open,
  options,
  emp,
  onClose,
  onDone,
}: {
  open: boolean;
  options: AnnexureOptions;
  emp?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [employee, setEmployee] = useState(emp ?? ALL);
  const [monthYear, setMonthYear] = useState(options.defaults.monthYear);
  const [effectiveDate, setEffectiveDate] = useState("");
  const [isCurrent, setIsCurrent] = useState(false);
  const [gratuity, setGratuity] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);

  const close = () => {
    if (busy) return;
    setResults(null);
    setErrors({});
    onClose();
  };

  const generate = async () => {
    const e: Record<string, string> = {};
    if (!monthYear.trim()) e.monthYear = "The Month / Year is required.";
    else if (!MONTH_YEAR.test(monthYear.trim())) e.monthYear = "The Month / Year field must be in MM/YYYY format.";
    if (!effectiveDate) e.effectiveDate = "The Effective Date is required.";
    setErrors(e);
    if (Object.keys(e).length) return;
    if (!window.confirm("Do you want to Generate Salary Annexure\n\nIt will take much time to process ..")) return;

    setBusy(true);
    try {
      const res = await authFetch("/api/payroll/annexures/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empIds: employee === ALL ? "all" : [Number(employee)],
          monthYear: monthYear.trim().padStart(7, "0"),
          effectiveDate,
          isCurrent,
          calculateGratuity: options.showGratuity && gratuity,
        }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string; errors?: Record<string, string[]>; data?: { results: Result[] } } | null;
      if (!res.ok || !json?.success) {
        if (json?.errors) setErrors(Object.fromEntries(Object.entries(json.errors).map(([k, v]) => [k, v[0]])));
        throw new Error(json?.message ?? "Unable to process data at the moment");
      }
      const list = json.data?.results ?? [];
      onDone();
      if (list.length === 1) {
        (list[0].status === "generated" ? toast.success : toast.error)(list[0].message);
        close();
      } else {
        toast.success(json.message ?? "Process Completed");
        setResults(list);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to process data at the moment");
    } finally {
      setBusy(false);
    }
  };

  const fieldError = (key: string) => (errors[key] ? <p className="text-sm text-red-500">{errors[key]}</p> : null);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{results ? "Process Completed" : "Generate Salary Annexure"}</DialogTitle>
          {results ? (
            <DialogDescription>
              Generated: {results.filter((r) => r.status === "generated").length} · Skipped: {results.filter((r) => r.status === "skipped").length}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        {results ? (
          <ul className="max-h-80 space-y-1 overflow-y-auto text-sm">
            {results.map((r) => (
              <li key={r.empId} className={r.status === "generated" ? "text-slate-700 dark:text-[#d5dae4]" : "text-red-600"}>
                {r.name}: {r.status === "generated" ? "Generated" : `Skipped — ${r.message}`}
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-4">
            <PlainSelect
              id="genEmployee"
              label="Employee"
              value={employee}
              onChange={setEmployee}
              options={[{ value: ALL, label: "All employees with a salary" }, ...options.employees.map((o) => ({ value: String(o.value), label: o.label }))]}
            />
            {fieldError("empIds")}
            <div className="space-y-1.5">
              <Label htmlFor="genMonth">Month / Year</Label>
              <Input id="genMonth" placeholder="MM/YYYY" value={monthYear} onChange={(e) => setMonthYear(e.target.value)} />
              {fieldError("monthYear")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="genEffective">
                Effective Date <span className="text-red-500">*</span>
              </Label>
              <Input id="genEffective" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
              {fieldError("effectiveDate")}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isCurrent} onCheckedChange={(v) => setIsCurrent(v === true)} />
              Current Annexure <span className="text-slate-500">(payroll uses the current annexure)</span>
            </label>
            {options.showGratuity ? (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={gratuity} onCheckedChange={(v) => setGratuity(v === true)} />
                Calculate Gratuity
              </label>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={busy} onClick={close}>
            Close
          </Button>
          {results ? null : (
            <Button disabled={busy} onClick={generate}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {busy ? "Generating Salary Annexure!!" : "Generate"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
