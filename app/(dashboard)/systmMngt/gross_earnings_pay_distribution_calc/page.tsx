"use client";

import { useState } from "react";
import Link from "next/link";
import { Calculator, ChevronRight, Database, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/auth/authFetch";
import type { GrossPayResult } from "@/lib/systmMngt/grossEarnings";

/**
 * CI systmMngt/gross_earnings_pay_distribution_calc ("Gross Earnings Pay Distribution Calculation"):
 * CTC + Calculate → read-only Annually / Monthly / Weekly / Daily (CI calculateGrossPay). Cancel goes
 * back to the configuration, as in CI.
 */
const OUT = [
  ["annually", "Annually"],
  ["monthly", "Monthly"],
  ["weekly", "Weekly"],
  ["daily", "Daily"],
] as const;

export default function GrossEarningsCalcPage() {
  const [ctc, setCtc] = useState("");
  const [result, setResult] = useState<GrossPayResult | null>(null);
  const [busy, setBusy] = useState(false);

  const calculate = async () => {
    setBusy(true);
    try {
      const res = await authFetch(`/api/systmMngt/gross_earnings_pay_distribution_calc?ctc=${encodeURIComponent(ctc)}`);
      const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string; data?: GrossPayResult } | null;
      if (!res.ok || !json?.success || !json.data) throw new Error(json?.message ?? "Calculation failed.");
      setResult(json.data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Calculation failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>System Manager</span>
                <ChevronRight size={15} className="text-slate-400" />
                <span className="font-semibold text-blue-600">Gross Earnings Pay Distribution Calculation</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Database className="h-6 w-6 text-blue-600" />
                <h1 className="text-2xl font-bold tracking-tight text-slate-800 md:text-3xl">Gross Earnings Pay Distribution Calculation</h1>
              </div>
            </div>
            <Button asChild variant="outline" size="icon" className="rounded-full" title="Cancel">
              <Link href="/systmMngt/gross_earnings_pay_distribution_config" aria-label="Cancel">
                <X className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>

        <form
          className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            void calculate();
          }}
        >
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] sm:items-center">
            <label htmlFor="ctc" className="text-sm font-medium text-slate-700">
              CTC <span className="text-red-500">*</span>
            </label>
            <Input id="ctc" inputMode="decimal" value={ctc} onChange={(e) => setCtc(e.target.value)} className="max-w-md" />
          </div>
          {OUT.map(([key, label]) => (
            <div key={key} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] sm:items-center">
              <label htmlFor={key} className="text-sm font-medium text-slate-700">{label}</label>
              <Input id={key} readOnly value={result ? String(result[key]) : ""} className="max-w-md bg-slate-50" />
            </div>
          ))}
          <div className="border-t border-slate-100 pt-4">
            <Button type="submit" disabled={busy || !ctc.trim()} className="rounded-full">
              <Calculator className="mr-1 h-4 w-4" /> {busy ? "Calculating…" : "Calculate"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
