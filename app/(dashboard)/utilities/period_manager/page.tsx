"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useOptions } from "@/lib/lookups/useOptions";
import { UtilityCard, UtilityPage, PlainSelect } from "../_components/UtilityPage";
import { callApi } from "../_components/download";

type Status = "generated" | "exists" | "not_generated";

interface PeriodTypeResult {
  type: string;
  status: Status;
  count: number;
  message: string;
}

interface GenerationResult {
  brand: { oaBrandId: number; name: string };
  results: PeriodTypeResult[];
  messages: { success?: string; warning?: string; danger?: string };
}

const STATUS_STYLE: Record<Status, { label: string; className: string }> = {
  generated: { label: "Generated", className: "bg-green-100 text-green-700" },
  exists: { label: "Already exists", className: "bg-amber-100 text-amber-700" },
  not_generated: { label: "Not generated", className: "bg-red-100 text-red-700" },
};

/**
 * CI utilities/period_manager — Organisation → Brand, "Sync Period" (period_mst_m::generatePeriods).
 * Organisation / brand lists are scoped by the server (sysadmin all, admin own organisation).
 */
export default function PeriodManagerPage() {
  const [pickedOaId, setOaId] = useState("");
  const [pickedBrandId, setOaBrandId] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);

  const organisations = useOptions("/api/lookups/organisations");
  // A caller who can only see one organisation / brand gets it preselected.
  const oaId = pickedOaId || (organisations.options.length === 1 ? String(organisations.options[0].value) : "");
  const brands = useOptions(oaId ? `/api/lookups/brands?oaId=${encodeURIComponent(oaId)}` : null);
  const oaBrandId = pickedBrandId || (brands.options.length === 1 ? String(brands.options[0].value) : "");

  const sync = async () => {
    if (!oaBrandId) {
      toast.error("Please Select A Brand");
      return;
    }
    setRunning(true);
    try {
      const data = await callApi<GenerationResult>("/api/utilities/period_manager/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oaBrandId: Number(oaBrandId) }),
      });
      setResult(data);
      if (data.messages.success) toast.success(data.messages.success);
      if (data.messages.warning) toast.warning(data.messages.warning);
      if (data.messages.danger) toast.error(data.messages.danger);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate periods.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <UtilityPage title="Period Manager">
      <UtilityCard>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <PlainSelect
            id="oaId"
            label="Organisation"
            value={oaId}
            onChange={(v) => {
              setOaId(v);
              setOaBrandId("");
              setResult(null);
            }}
            options={organisations.options}
            placeholder={organisations.loading ? "Loading…" : "Select organisation"}
          />
          <PlainSelect
            id="oaBrandId"
            label="Brand"
            value={oaBrandId}
            onChange={(v) => {
              setOaBrandId(v);
              setResult(null);
            }}
            options={brands.options}
            placeholder={brands.loading ? "Loading…" : oaId ? "Select brand" : "Select an organisation first"}
            disabled={!oaId}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={sync} disabled={running || !oaBrandId}>
            <RefreshCw className={`mr-2 h-4 w-4 ${running ? "animate-spin" : ""}`} />
            {running ? "Syncing…" : "Sync Period"}
          </Button>
        </div>
      </UtilityCard>

      {result && (
        <UtilityCard>
          <h2 className="text-lg font-semibold text-slate-800">Result for {result.brand.name}</h2>
          <div className="space-y-2 text-sm">
            {result.messages.success && <p className="rounded-lg bg-green-50 px-3 py-2 text-green-700">{result.messages.success}</p>}
            {result.messages.warning && <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-700">{result.messages.warning}</p>}
            {result.messages.danger && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{result.messages.danger}</p>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2 pr-4 font-medium">Period Type</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium text-right">Created</th>
                  <th className="py-2 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((r) => (
                  <tr key={r.type} className="border-b last:border-0">
                    <td className="py-2 pr-4 text-slate-800">{r.type}</td>
                    <td className="py-2 pr-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[r.status].className}`}>
                        {STATUS_STYLE[r.status].label}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{r.count}</td>
                    <td className="py-2 text-slate-600">{r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </UtilityCard>
      )}
    </UtilityPage>
  );
}
