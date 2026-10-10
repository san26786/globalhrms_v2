"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { UtilityCard, UtilityPage } from "../_components/UtilityPage";
import { callApi } from "../_components/download";

interface BrandItem {
  oaBrandId: number;
  name: string;
  code: string;
  organisation: string | null;
}

interface SyncResult {
  attributes: number;
  brands: Array<{ oaBrandId: number; name: string; inserted: number; alreadyPresent: number }>;
  totalInserted: number;
  message: string;
}

/**
 * CI utilities/sync_company_settings ("Sync Brand Setting") — tick brands (or check all) and add the
 * missing company-setting rows for each. The brand list is scoped by the server.
 */
export default function SyncCompanySettingsPage() {
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    callApi<BrandItem[]>("/api/utilities/sync_company_settings")
      .then((data) => !cancelled && setBrands(data))
      .catch((e: unknown) => !cancelled && setLoadError(e instanceof Error ? e.message : "Failed to load brands."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const allChecked = brands.length > 0 && selected.size === brands.length;
  const someChecked = selected.size > 0 && !allChecked;
  const showOrganisation = useMemo(() => new Set(brands.map((b) => b.organisation)).size > 1, [brands]);

  const toggle = (id: number, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const toggleAll = (on: boolean) => setSelected(on ? new Set(brands.map((b) => b.oaBrandId)) : new Set());

  const sync = async () => {
    if (!selected.size) {
      toast.error("Please select at least one brand.");
      return;
    }
    setRunning(true);
    try {
      const data = await callApi<SyncResult>("/api/utilities/sync_company_settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandIds: [...selected] }),
      });
      setResult(data);
      toast.success(data.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Some settings failed to sync");
    } finally {
      setRunning(false);
    }
  };

  return (
    <UtilityPage title="Sync Brand Setting">
      <UtilityCard>
        {loading && <p className="text-sm text-gray-400">Loading…</p>}
        {loadError && <p className="text-sm text-red-500">{loadError}</p>}
        {!loading && !loadError && brands.length === 0 && <p className="text-sm text-gray-500">No brands available.</p>}

        {brands.length > 0 && (
          <div className="rounded-2xl border border-slate-200">
            <label className="flex items-center gap-3 border-b bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 rounded-t-2xl">
              <Checkbox
                checked={allChecked ? true : someChecked ? "indeterminate" : false}
                onCheckedChange={(v) => toggleAll(v === true)}
                aria-label="Check all brands"
              />
              Check All ({selected.size}/{brands.length})
            </label>
            <div className="max-h-[28rem] overflow-y-auto divide-y">
              {brands.map((b) => (
                <label key={b.oaBrandId} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 cursor-pointer">
                  <Checkbox checked={selected.has(b.oaBrandId)} onCheckedChange={(v) => toggle(b.oaBrandId, v === true)} />
                  <span className="text-slate-800">{b.name}</span>
                  <span className="text-xs text-slate-400">{b.code}</span>
                  {showOrganisation && b.organisation && <span className="ml-auto text-xs text-slate-500">{b.organisation}</span>}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={sync} disabled={running || selected.size === 0}>
            <RefreshCw className={`mr-2 h-4 w-4 ${running ? "animate-spin" : ""}`} />
            {running ? "Syncing…" : "Sync Company Settings"}
          </Button>
        </div>
      </UtilityCard>

      {result && (
        <UtilityCard>
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{result.message}</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2 pr-4 font-medium">Brand</th>
                <th className="py-2 pr-4 font-medium text-right">Added</th>
                <th className="py-2 font-medium text-right">Already present</th>
              </tr>
            </thead>
            <tbody>
              {result.brands.map((b) => (
                <tr key={b.oaBrandId} className="border-b last:border-0">
                  <td className="py-2 pr-4 text-slate-800">{b.name}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{b.inserted}</td>
                  <td className="py-2 text-right tabular-nums">{b.alreadyPresent}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-500">{result.attributes} company setting attribute(s) checked per brand.</p>
        </UtilityCard>
      )}
    </UtilityPage>
  );
}
