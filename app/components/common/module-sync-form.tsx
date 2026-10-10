"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useOptions } from "@/lib/lookups/useOptions";
import type { SelectOption } from "@/lib/form-builder/formTypes";
import { PlainSelect, UtilityCard, UtilityPage } from "@/(dashboard)/utilities/_components/UtilityPage";
import { callApi } from "@/(dashboard)/utilities/_components/download";

interface ModulesResponse {
  modules: Array<{ value: string; label: string }>;
  canChooseBrand: boolean;
}

interface SyncResult {
  moduleLabel: string;
  brand: { oaBrandId: number; name: string };
  updated: number;
  inserted: number;
  message: string;
}

/**
 * CI common/modulesync — "Sync Employee Details": pick a module (its *_employee table) and, for the
 * system administrator, the organisation / brand; everyone else syncs their active brand.
 */
export default function ModuleSyncForm() {
  const [config, setConfig] = useState<ModulesResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [module, setModule] = useState("");
  const [pickedOaId, setOaId] = useState("");
  const [oaBrandId, setOaBrandId] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    callApi<ModulesResponse>("/api/common/module-sync")
      .then((data) => !cancelled && setConfig(data))
      .catch((e) => !cancelled && setLoadError(e instanceof Error ? e.message : "Failed to load modules."));
    return () => {
      cancelled = true;
    };
  }, []);

  const chooseBrand = !!config?.canChooseBrand;
  const organisations = useOptions(chooseBrand ? "/api/lookups/organisations" : null);
  const oaId = pickedOaId || (organisations.options.length === 1 ? String(organisations.options[0].value) : "");
  const brands = useOptions(chooseBrand && oaId ? `/api/lookups/brands?oaId=${encodeURIComponent(oaId)}` : null);

  const sync = async () => {
    if (!module) {
      toast.error("Please select a module.");
      return;
    }
    if (chooseBrand && !oaBrandId) {
      toast.error("Please Select A Brand");
      return;
    }
    setRunning(true);
    try {
      const data = await callApi<SyncResult>("/api/common/module-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module, ...(chooseBrand ? { oaBrandId: Number(oaBrandId) } : {}) }),
      });
      setResult(data);
      toast.success(data.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setRunning(false);
    }
  };

  const moduleOptions: SelectOption[] = config?.modules ?? [];

  return (
    <UtilityPage title="Sync Employee Details">
      <UtilityCard>
        {loadError && <p className="text-sm text-red-500">{loadError}</p>}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {chooseBrand && (
            <>
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
            </>
          )}
          <PlainSelect
            id="module"
            label="Module"
            value={module}
            onChange={(v) => {
              setModule(v);
              setResult(null);
            }}
            options={moduleOptions}
            placeholder={config ? "Select module" : "Loading…"}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={sync} disabled={running || !config}>
            <RefreshCw className={`mr-2 h-4 w-4 ${running ? "animate-spin" : ""}`} />
            {running ? "Syncing…" : "Sync Employee Details"}
          </Button>
        </div>
      </UtilityCard>

      {result && (
        <UtilityCard>
          <h2 className="text-lg font-semibold text-slate-800">
            {result.moduleLabel} — {result.brand.name}
          </h2>
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            {result.message}: {result.inserted} employee(s) added, {result.updated} updated.
          </p>
        </UtilityCard>
      )}
    </UtilityPage>
  );
}
