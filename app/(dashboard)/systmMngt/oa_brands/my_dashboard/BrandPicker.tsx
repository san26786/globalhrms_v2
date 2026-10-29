"use client";

import { useMemo, useState } from "react";
import { ArrowRightLeft, Building2, ChevronRight, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/auth/authFetch";
import type { BrandPickerModel, PickerView } from "@/lib/systmMngt/brandPicker";
import { useInit } from "../../_shared/useInit";

/**
 * CI include/mydashboard_v ("Organisation Brands") / partners_dash_v ("Partner Brands"): a searchable
 * table — Brand ID, Brand, Brand Name, Account Name, Country, Is Active, Primary Brand — with "Switch
 * to" per row. Switching re-issues the session for that brand (POST /api/header/switch-brand) and opens
 * the dashboard.
 */
export default function BrandPicker({ view }: { view: PickerView }) {
  const { data, error } = useInit<BrandPickerModel>(`/api/systmMngt/oa_brands/picker?view=${view}`);
  const [term, setTerm] = useState("");
  const [switching, setSwitching] = useState<number | null>(null);

  const rows = useMemo(() => {
    const t = term.trim().toLowerCase();
    const list = data?.brands ?? [];
    if (!t) return list;
    return list.filter((b) =>
      [String(b.oaBrandId), b.code, b.name, b.organisation ?? "", b.country ?? ""].some((v) => v.toLowerCase().includes(t)),
    );
  }, [data, term]);

  const switchTo = async (oaBrandId: number) => {
    setSwitching(oaBrandId);
    try {
      const res = await authFetch("/api/header/switch-brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oaBrandId }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
      if (!res.ok || !json?.success) throw new Error(json?.message ?? "Could not switch brand.");
      // Full load: menus, header and page data are brand-scoped.
      window.location.assign("/dashboard");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not switch brand.");
      setSwitching(null);
    }
  };

  if (error) return <p className="p-6 text-sm text-rose-700 dark:text-rose-300">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-[#535768] dark:text-[#aab3c5]">Loading…</p>;

  return (
    <div className="p-4">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border bg-white dark:bg-[#111a2e] p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-[#535768] dark:text-[#aab3c5]">
            <span>System Manager</span>
            <ChevronRight size={15} className="text-[#535768] dark:text-[#aab3c5]" />
            <span className="font-semibold text-[#0b5394] dark:text-[#8cb8f0]">{data.title}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-[#0b5394] dark:text-[#8cb8f0]" />
            <h1 className="text-2xl font-semibold tracking-tight text-[#1a1818] dark:text-[#f1f3f8] md:text-3xl">{data.title}</h1>
          </div>
        </div>

        <div className="space-y-4 rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111a2e] p-6 shadow-sm">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#535768] dark:text-[#aab3c5]" />
            <Input aria-label="Search brands" placeholder="Search…" value={term} onChange={(e) => setTerm(e.target.value)} className="pl-9" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-white/10 text-xs uppercase text-[#535768] dark:text-[#aab3c5]">
                <tr>
                  {["Brand ID", "Brand", "Brand Name", "Account Name", "Country", "Is Active", "Primary Brand", "Actions"].map((h) => (
                    <th key={h} className="px-3 py-2 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.oaBrandId} className={`border-b border-slate-100 dark:border-white/10 ${b.isCurrent ? "bg-[#e3edf9] dark:bg-[#16233d]" : ""}`}>
                    <td className="px-3 py-2">{b.oaBrandId}</td>
                    <td className="px-3 py-2">{b.code}</td>
                    <td className="px-3 py-2 font-medium text-[#1a1818] dark:text-[#f1f3f8]">{b.name}</td>
                    <td className="px-3 py-2">{b.organisation}</td>
                    <td className="px-3 py-2">{b.country}</td>
                    <td className="px-3 py-2">{b.isActive ? "Yes" : "No"}</td>
                    <td className="px-3 py-2">{b.isPrimary ? "Yes" : "No"}</td>
                    <td className="px-3 py-2">
                      {b.isCurrent ? (
                        <span className="text-xs font-medium text-[#083f72] dark:text-[#cfe1fa]">Current brand</span>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          disabled={!b.isActive || switching !== null}
                          title={b.isActive ? "Switch to" : "Inactive brand"}
                          onClick={() => void switchTo(b.oaBrandId)}
                        >
                          <ArrowRightLeft className="mr-1 h-4 w-4" />
                          {switching === b.oaBrandId ? "Switching…" : "Switch to"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-[#535768] dark:text-[#aab3c5]">No brands found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
