"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import ResourceListPage, { type ResourceListColumn } from "@/components/resource/ResourceListPage";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth/authFetch";
import { useOptions } from "@/lib/lookups/useOptions";
import { typeQuery, useMasterDataMeta } from "@/components/common/master-data-form";
import { PlainSelect } from "@/(dashboard)/utilities/_components/UtilityPage";

interface MasterRow {
  id: number;
  code: string | null;
  name: string;
  description: string | null;
  typeId: number;
  typeName: string | null;
  parentName: string | null;
  countryName: string | null;
  canEdit: boolean;
  canDelete: boolean;
}

/**
 * CI common/indp_mst_data::index($MstrID) — listview of independent_mst_vw for one type, or every
 * master with a "System Entity" filter when no type is given. "Sync Masters" (CI
 * replicateMstrForBrand) is offered to non-sysadmins on non-system types.
 */
export default function MasterDataList({ typeId }: { typeId: number | null }) {
  const router = useRouter();
  const { meta, error } = useMasterDataMeta(typeId);
  const types = useOptions(typeId ? null : "/api/common/master-data/options?kind=types");
  const [syncing, setSyncing] = useState(false);

  const columns: ResourceListColumn<MasterRow>[] = [
    { key: "code", header: "Master Code", sortKey: "MSTR_CD" },
    { key: "name", header: "Master Name", sortKey: "MSTR_NM" },
    { key: "description", header: "Description" },
    ...(typeId ? [] : [{ key: "typeName", header: "System Entity", sortKey: "TYP_ID" } satisfies ResourceListColumn<MasterRow>]),
    { key: "parentName", header: "Parent" },
    { key: "countryName", header: "Country" },
  ];

  const sync = async (refresh: () => void) => {
    if (!typeId) return;
    setSyncing(true);
    try {
      const res = await authFetch("/api/common/master-data/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typeId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Sync failed.");
      toast.success(`${json.data.message} (${json.data.inserted} added)`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  if (error) return <p className="p-6 text-sm text-red-500">{error}</p>;

  const title = meta?.title ?? (typeId ? "" : "Masters");

  return (
    <ResourceListPage<MasterRow>
      title={title}
      entity="master-data"
      objectName="independent_mst_vw"
      apiPath="/api/common/master-data"
      basePath="/common/master-data"
      params={typeId ? { typeId: String(typeId) } : undefined}
      addHref={`/common/master-data/add-master-data${typeQuery(typeId)}`}
      editHref={(r) => `/common/master-data/edit-master-data/${r.id}${typeQuery(typeId ?? r.typeId)}`}
      canEditRow={(r) => r.canEdit}
      canDeleteRow={(r) => r.canDelete}
      getId={(r) => r.id}
      searchPlaceholder="Search code, name or description..."
      columns={columns}
      toolbar={({ refresh }) =>
        !typeId || meta?.canSync ? (
          <div className="flex flex-wrap items-end justify-between gap-4 rounded-3xl border bg-white p-4 shadow-sm">
            {!typeId && (
              <div className="w-full md:w-1/2">
                <PlainSelect
                  id="typeFilter"
                  label="System Entity"
                  value=""
                  onChange={(v) => router.push(`/common/master-data${typeQuery(Number(v))}`)}
                  options={types.options}
                  placeholder={types.loading ? "Loading…" : "Select a system entity"}
                />
              </div>
            )}
            {meta?.canSync && (
              <Button variant="outline" onClick={() => sync(refresh)} disabled={syncing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing…" : "Sync Masters"}
              </Button>
            )}
          </div>
        ) : null
      }
    />
  );
}
