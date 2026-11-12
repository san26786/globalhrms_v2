"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { authFetch } from "@/lib/auth/authFetch";
import type { RepaymentSchedule as Schedule } from "@/lib/payroll/advanceSalary";

/**
 * CI advance_salary edit form's repayment grid: each instalment's month, amount and Paid tick. Saving the
 * ticks recomputes the advance's Total Paid / Total Due. Rules: lib/payroll/advanceSalary.ts.
 */
export default function RepaymentSchedule({ id }: { id: string }) {
  const api = `/api/advance_salary/${encodeURIComponent(id)}/repayments`;
  const [data, setData] = useState<Schedule | null>(null);
  const [paid, setPaid] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const apply = (schedule: Schedule) => {
    setData(schedule);
    setPaid(Object.fromEntries(schedule.rows.map((r) => [r.id, r.paid])));
  };

  useEffect(() => {
    let cancelled = false;
    authFetch(api)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success) apply(json.data as Schedule);
        else setError(json.message ?? "Could not load the repayment schedule.");
      })
      .catch(() => !cancelled && setError("Could not load the repayment schedule."));
    return () => {
      cancelled = true;
    };
  }, [api]);

  const save = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const res = await authFetch(api, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid: Object.fromEntries(data.rows.map((r) => [String(r.id), !!paid[r.id]])) }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.message ?? "Save failed.");
      apply(json.data as Schedule);
      toast.success(json.message ?? "Saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  if (error) return <p className="px-4 pb-6 text-sm text-red-500">{error}</p>;
  if (!data) return null;
  const changed = data.rows.some((r) => r.paid !== !!paid[r.id]);

  return (
    <div className="px-4 pb-6">
      <section className="rounded-3xl border bg-white p-4 shadow-sm brand:border-slate-200 dark:border-white/10 dark:bg-[#111a2e]">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-[#1a1818] dark:text-[#e6e9f0]">Repayment Schedule</h2>
          <p className="text-sm text-[#535768] dark:text-[#aab3c5]">
            Total Paid <strong>{data.totalPaid}</strong> · Total Due <strong>{data.totalDue}</strong>
          </p>
        </div>
        {data.rows.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[#535768] dark:border-white/10 dark:text-[#aab3c5]">
                <th className="py-2 font-medium">Date</th>
                <th className="py-2 font-medium">Repayment Amount</th>
                <th className="py-2 font-medium">Payment Status</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 dark:border-white/10">
                  <td className="py-2">{r.monthYear}</td>
                  <td className="py-2">{r.amount}</td>
                  <td className="py-2">
                    <label className="inline-flex items-center gap-2">
                      <Checkbox
                        checked={!!paid[r.id]}
                        disabled={!data.canEdit || saving}
                        onCheckedChange={(v) => setPaid((p) => ({ ...p, [r.id]: v === true }))}
                      />
                      {paid[r.id] ? "Paid" : "Unpaid"}
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-[#535768] dark:text-[#aab3c5]">This advance has no instalments.</p>
        )}
        {data.canEdit && data.rows.length ? (
          <div className="mt-4 flex justify-end">
            <Button onClick={save} disabled={saving || !changed}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Payment Status
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
