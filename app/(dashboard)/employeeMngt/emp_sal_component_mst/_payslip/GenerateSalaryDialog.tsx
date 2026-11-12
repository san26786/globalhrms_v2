"use client";

import { useEffect, useMemo, useState } from "react";
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
 * CI Payroll Processing's "Generate Salary" modal: all employees or the chosen ones, the month, and — for one
 * employee — "[ More Options + ]" (the month's incentives, absent days, advances and loan instalments as the run would
 * take them, which HR may change) and Preview (the payslip PDF, nothing saved). The result lists every employee;
 * an employee held back by the timesheet check can be ticked and generated again as an exception.
 * Rules: lib/payroll/run/*.
 */
export interface PayrollOptions {
  employees: Array<{ value: number; label: string }>;
  defaults: { monthYear: string };
  permissions: { generate: boolean; markPaid: boolean };
  commission: boolean;
  message: string | null;
}

interface Result {
  empId: number;
  name: string;
  status: "generated" | "skipped" | "needs_timesheet_exception";
  message: string;
  net?: string;
  periods?: Array<{ period: string; status: string }>;
}

type InputKey = "incentivesArrears" | "absentDays" | "commissions" | "loanDisbursed" | "advanceSalary" | "advanceRepayment" | "loanInstallments";
const INPUTS: Array<{ key: InputKey; label: string; step: string }> = [
  { key: "incentivesArrears", label: "Incentives/Arrears", step: "0.01" },
  { key: "absentDays", label: "Absent Days", step: "0.5" },
  { key: "commissions", label: "Commission", step: "0.01" },
  { key: "loanDisbursed", label: "Loans Disbursed", step: "0.01" },
  { key: "advanceSalary", label: "Advance Salary", step: "0.01" },
  { key: "advanceRepayment", label: "Advance Repayment", step: "0.01" },
  { key: "loanInstallments", label: "Loans Installment", step: "0.01" },
];
const EMPTY: Record<InputKey, string> = { incentivesArrears: "0", absentDays: "0", commissions: "0", loanDisbursed: "0", advanceSalary: "0", advanceRepayment: "0", loanInstallments: "0" };
const MONTH_YEAR = /^(0?[1-9]|1[0-2])\/\d{4}$/;
const ALL = "all";
const CHOOSE = "choose";

type Json = { success?: boolean; message?: string; errors?: Record<string, string[]>; data?: Record<string, unknown> } | null;

export default function GenerateSalaryDialog({
  options,
  emp,
  monthYear: initialMonth,
  onClose,
  onDone,
}: {
  options: PayrollOptions;
  emp?: string;
  monthYear?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState(emp ? CHOOSE : ALL);
  const [chosen, setChosen] = useState<Set<number>>(() => new Set(emp ? [Number(emp)] : []));
  const [search, setSearch] = useState("");
  const [monthYear, setMonthYear] = useState(initialMonth && MONTH_YEAR.test(initialMonth) ? initialMonth : options.defaults.monthYear);
  const [more, setMore] = useState(false);
  const [prefill, setPrefill] = useState<{ key: string; ok: boolean; values: Record<InputKey, string>; warning: string | null } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<null | "generate" | "preview">(null);
  const [results, setResults] = useState<Result[] | null>(null);
  const [exceptions, setExceptions] = useState<Set<number>>(new Set());
  const [preview, setPreview] = useState<string | null>(null);

  const ids = useMemo(() => (mode === ALL ? [] : [...chosen]), [mode, chosen]);
  const single = mode === CHOOSE && ids.length === 1 ? ids[0] : null;
  const month = monthYear.trim();

  // "More Options" pre-fill for one employee and month (CI: six calls on the employee / month change).
  const key = single && MONTH_YEAR.test(month) ? `${single}|${month.padStart(7, "0")}` : null;
  useEffect(() => {
    if (!key) return;
    let live = true;
    const [id, my] = key.split("|");
    authFetch(`/api/payroll/payslips/inputs?emp=${id}&monthYear=${encodeURIComponent(my)}`)
      .then((r) => r.json())
      .then((json: Json) => {
        if (!live) return;
        const d = (json?.data ?? {}) as Record<string, unknown>;
        if (!json?.success) throw new Error(json?.message ?? "Unable to read the employee's figures.");
        setPrefill({
          key,
          ok: true,
          values: {
            incentivesArrears: String(d.incentivesArrears ?? "0"), absentDays: String(d.absentDays ?? "0"), commissions: String(d.commissions ?? "0"),
            loanDisbursed: String(d.loanDisbursed ?? "0"), advanceSalary: String(d.advanceSalary ?? "0"), advanceRepayment: String(d.advanceRepayment ?? "0"),
            loanInstallments: String(d.loanInstallments ?? "0"),
          },
          warning: typeof d.message === "string" ? d.message : null,
        });
      })
      .catch((e: unknown) => live && setPrefill({ key, ok: false, values: EMPTY, warning: e instanceof Error ? e.message : "Unable to read the employee's figures." }));
    return () => {
      live = false;
    };
  }, [key]);
  const loading = !!key && prefill?.key !== key;
  const inputs = prefill && prefill.key === key ? prefill.values : EMPTY;
  const warning = prefill && prefill.key === key ? prefill.warning : null;
  const setInput = (k: InputKey, v: string) => setPrefill((p) => (p && p.key === key ? { ...p, values: { ...p.values, [k]: v } } : p));

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const close = () => {
    if (busy) return;
    onClose();
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!month) e.monthYear = "The Month / Year is required.";
    else if (!MONTH_YEAR.test(month)) e.monthYear = "The Month / Year field must be in MM/YYYY format.";
    if (mode === CHOOSE && !ids.length) e.empIds = "The Employee field is required.";
    setErrors(e);
    return !Object.keys(e).length;
  };

  /** `retry`: only the ticked employees again, as timesheet exceptions. */
  const body = (retry?: Set<number>) => ({
    empIds: retry ? [...retry] : mode === ALL ? "all" : ids,
    monthYear: month.padStart(7, "0"),
    // The More Options figures (as pre-filled, or as HR changed them); never zeros from a failed pre-fill.
    ...(single && prefill?.key === key && prefill.ok && (!retry || retry.has(single))
      ? { inputs: Object.fromEntries(INPUTS.filter((i) => i.key !== "commissions" || options.commission).map((i) => [i.key, inputs[i.key].trim()])) }
      : {}),
    timesheetExceptions: retry ? [...retry] : [],
  });

  const fail = (json: Json, fallback: string) => {
    if (json?.errors) {
      const flat = Object.fromEntries(Object.entries(json.errors).map(([k, v]) => [k.replace(/^inputs\./, ""), v[0]]));
      setErrors(flat);
      if (Object.keys(flat).some((k) => INPUTS.some((i) => i.key === k))) setMore(true);
    }
    toast.error(json?.message ?? fallback);
  };

  const generate = async (retry?: Set<number>) => {
    if (!retry && !validate()) return;
    if (!window.confirm("Do you want to Generate Salary\n\nIt will take much time to process ..")) return;
    setBusy("generate");
    try {
      const res = await authFetch("/api/payroll/payslips/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body(retry)),
      });
      const json = (await res.json().catch(() => null)) as Json;
      if (!res.ok || !json?.success) return fail(json, "Unable to process data at the moment");
      const list = (json.data?.results ?? []) as Result[];
      for (const w of (json.data?.warnings ?? []) as string[]) toast.warning(w);
      onDone();
      setPreview(null);
      setResults(list);
      setExceptions(new Set());
      if (list.length === 1) (list[0].status === "generated" ? toast.success : toast.error)(json.message ?? list[0].message);
      else toast.success(json.message ?? "Process Completed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to process data at the moment");
    } finally {
      setBusy(null);
    }
  };

  const runPreview = async () => {
    if (!validate() || !single) return;
    if (!window.confirm("Do you want to Preview Salary\n\nIt will take some time to process preview..")) return;
    setBusy("preview");
    try {
      const res = await authFetch("/api/payroll/payslips/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body(exceptions.has(single) ? new Set([single]) : undefined)),
      });
      if (res.ok && (res.headers.get("Content-Type") ?? "").includes("application/pdf")) {
        setPreview(URL.createObjectURL(await res.blob()));
        return;
      }
      const json = (await res.json().catch(() => null)) as Json;
      if (!res.ok || !json?.success) return fail(json, "Unable to process data at the moment");
      const list = (json.data?.results ?? []) as Result[];
      setResults(list);
      toast.error(json.message ?? list[0]?.message ?? "The salary could not be previewed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to process data at the moment");
    } finally {
      setBusy(null);
    }
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? options.employees.filter((o) => o.label.toLowerCase().includes(q)) : options.employees;
  }, [search, options.employees]);
  const toggle = (id: number, on: boolean) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const fieldError = (key: string) => (errors[key] ? <p className="text-sm text-red-500">{errors[key]}</p> : null);
  const held = results?.filter((r) => r.status === "needs_timesheet_exception") ?? [];

  if (preview) {
    return (
      <Dialog open onOpenChange={(v) => !v && !busy && setPreview(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Salary Preview</DialogTitle>
            <DialogDescription>Nothing has been saved yet.</DialogDescription>
          </DialogHeader>
          <iframe title="Salary Preview" src={preview} className="h-[500px] w-full rounded border" />
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={!!busy} onClick={() => setPreview(null)}>
              Back
            </Button>
            <Button disabled={!!busy} onClick={() => generate()}>
              {busy === "generate" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {busy === "generate" ? "Generating Salary!!" : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(v) => !v && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{results ? "Salary Generation" : "Generate Salary"}</DialogTitle>
          {results ? (
            <DialogDescription>
              Generated: {results.filter((r) => r.status === "generated").length} · Skipped: {results.filter((r) => r.status !== "generated").length}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        {results ? (
          <ul className="max-h-96 space-y-2 overflow-y-auto text-sm">
            {results.map((r) => (
              <li key={r.empId} className={r.status === "generated" ? "text-slate-700 dark:text-[#d5dae4]" : "text-red-600"}>
                {r.status === "needs_timesheet_exception" ? (
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={exceptions.has(r.empId)}
                      onCheckedChange={(v) =>
                        setExceptions((prev) => {
                          const next = new Set(prev);
                          if (v === true) next.add(r.empId);
                          else next.delete(r.empId);
                          return next;
                        })
                      }
                    />
                    <span>
                      <b>{r.name}</b> - Timesheet Issue
                    </span>
                  </label>
                ) : (
                  <span>
                    <b>{r.name}</b> - {r.message}
                    {r.status === "generated" && r.net ? <span className="text-slate-500"> (net {r.net})</span> : null}
                  </span>
                )}
                {r.periods?.length ? (
                  <table className="mt-1 ml-6 border text-xs">
                    <thead>
                      <tr>
                        <th className="border px-2 py-0.5 text-left">Timesheet Period</th>
                        <th className="border px-2 py-0.5 text-left">Timesheet Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.periods.map((p, i) => (
                        <tr key={i}>
                          <td className="border px-2 py-0.5">{p.period}</td>
                          <td className="border px-2 py-0.5">{p.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-4">
            <PlainSelect
              id="salEmployees"
              label="Employee"
              value={mode}
              onChange={setMode}
              options={[
                { value: ALL, label: "All employees" },
                { value: CHOOSE, label: "Choose employees" },
              ]}
            />
            {mode === CHOOSE ? (
              <div className="space-y-1.5">
                <Input placeholder="Search employees" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8" />
                <div className="max-h-44 space-y-1 overflow-y-auto rounded border p-2 dark:border-white/10">
                  {visible.map((o) => (
                    <label key={o.value} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={chosen.has(o.value)} onCheckedChange={(v) => toggle(o.value, v === true)} />
                      {o.label}
                    </label>
                  ))}
                  {!visible.length ? <p className="text-sm text-slate-500">No employee matches.</p> : null}
                </div>
                <p className="text-xs text-slate-500">{ids.length} selected</p>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Current employees and those who left in or after the month, with a current annexure.</p>
            )}
            {fieldError("empIds")}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="salMonth">Month / Year</Label>
                {single ? (
                  <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => setMore((v) => !v)}>
                    {more ? "[ Less Options - ]" : "[ More Options + ]"}
                  </button>
                ) : null}
              </div>
              <Input id="salMonth" placeholder="MM/YYYY" value={monthYear} onChange={(e) => setMonthYear(e.target.value)} />
              {fieldError("monthYear")}
            </div>
            {warning && single ? <p className="text-sm text-amber-600">{warning}</p> : null}
            {single && more ? (
              <div className="grid grid-cols-2 gap-3">
                {INPUTS.filter((i) => i.key !== "commissions" || options.commission).map((i) => (
                  <div key={i.key} className="space-y-1">
                    <Label htmlFor={`sal_${i.key}`} className="text-xs">
                      {i.label}
                    </Label>
                    <Input
                      id={`sal_${i.key}`}
                      type="number"
                      step={i.step}
                      className="h-8"
                      disabled={loading}
                      value={inputs[i.key]}
                      onChange={(e) => setInput(i.key, e.target.value)}
                    />
                    {fieldError(i.key)}
                  </div>
                ))}
              </div>
            ) : null}
            {!single && mode === CHOOSE && ids.length > 1 ? (
              <p className="text-xs text-slate-500">Each employee&apos;s incentives, advances and loan instalments are taken from their records.</p>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={!!busy} onClick={results ? () => setResults(null) : close}>
            {results ? "Back" : "Close"}
          </Button>
          {results && held.length ? (
            <Button disabled={!!busy || !exceptions.size} onClick={() => generate(exceptions)}>
              {busy === "generate" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate ticked as exception
            </Button>
          ) : null}
          {!results && single ? (
            <Button variant="outline" disabled={!!busy || loading} onClick={runPreview}>
              {busy === "preview" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {busy === "preview" ? "Generating Salary Preview!!" : "Preview"}
            </Button>
          ) : null}
          {!results ? (
            <Button disabled={!!busy || loading} onClick={() => generate()}>
              {busy === "generate" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {busy === "generate" ? "Generating Salary!!" : "Generate"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
