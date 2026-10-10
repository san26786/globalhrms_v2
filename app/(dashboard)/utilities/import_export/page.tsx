"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useOptions } from "@/lib/lookups/useOptions";
import type { SelectOption } from "@/lib/form-builder/formTypes";
import { PlainSelect, UtilityCard, UtilityPage } from "../_components/UtilityPage";
import { callApi, downloadFile } from "../_components/download";

interface ExportableTable {
  table: string;
  label: string;
}

/**
 * CI utilities/import_export — export one table of a brand as CSV. Only whitelisted brand tables are
 * offered and the rows are always limited to the chosen brand. (CI's import was never functional and
 * is not provided.)
 */
export default function ImportExportPage() {
  const [tables, setTables] = useState<SelectOption[]>([]);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [table, setTable] = useState("");
  const [pickedOaId, setOaId] = useState("");
  const [pickedBrandId, setOaBrandId] = useState("");
  const [busy, setBusy] = useState(false);

  const organisations = useOptions("/api/lookups/organisations");
  const oaId = pickedOaId || (organisations.options.length === 1 ? String(organisations.options[0].value) : "");
  const brands = useOptions(oaId ? `/api/lookups/brands?oaId=${encodeURIComponent(oaId)}` : null);
  const oaBrandId = pickedBrandId || (brands.options.length === 1 ? String(brands.options[0].value) : "");

  useEffect(() => {
    let cancelled = false;
    callApi<ExportableTable[]>("/api/utilities/import_export")
      .then((data) => !cancelled && setTables(data.map((t) => ({ value: t.table, label: `${t.label} (${t.table})` }))))
      .catch((e: unknown) => !cancelled && setTablesError(e instanceof Error ? e.message : "Failed to load tables."));
    return () => {
      cancelled = true;
    };
  }, []);

  const exportNow = async () => {
    if (!table) {
      toast.error("Please Select A Table !");
      return;
    }
    const params = new URLSearchParams({ table });
    if (oaBrandId) params.set("oaBrandId", oaBrandId);
    setBusy(true);
    try {
      await downloadFile(`/api/utilities/import_export/export?${params.toString()}`, `${table}.csv`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <UtilityPage title="Import / Export">
      <UtilityCard>
        {tablesError && <p className="text-sm text-red-500">{tablesError}</p>}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <PlainSelect
            id="oaId"
            label="Organisation"
            value={oaId}
            onChange={(v) => {
              setOaId(v);
              setOaBrandId("");
            }}
            options={organisations.options}
            placeholder={organisations.loading ? "Loading…" : "Select organisation"}
          />
          <PlainSelect
            id="oaBrandId"
            label="Brand"
            value={oaBrandId}
            onChange={setOaBrandId}
            options={brands.options}
            placeholder={brands.loading ? "Loading…" : oaId ? "Select brand (default: current brand)" : "Select an organisation first"}
            disabled={!oaId}
          />
          <PlainSelect id="table" label="Table" value={table} onChange={setTable} options={tables} placeholder="Select table" />
        </div>
        <div className="flex justify-end">
          <Button onClick={exportNow} disabled={busy || !table}>
            <Download className="mr-2 h-4 w-4" />
            {busy ? "Exporting…" : "Export"}
          </Button>
        </div>
      </UtilityCard>
    </UtilityPage>
  );
}
