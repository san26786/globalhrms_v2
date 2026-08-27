// app/(dashboard)/common/config-mapping/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { Database, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import ImportExportControls from "@/components/import-export/ImportExportControls";

const columnSettings = [
  { systemName: "CNFG_MPPNG_ID", displayName: "Mapping ID", visibleInList: true, visibleInForm: true },
  { systemName: "CNFG_CD", displayName: "Config Code", visibleInList: true, visibleInForm: true },
  { systemName: "CNFG_NM", displayName: "Config Name", visibleInList: true, visibleInForm: true },
  { systemName: "CNFG_VAL", displayName: "Config Value", visibleInList: true, visibleInForm: true }
];

export default function ConfigMappingPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const tableRef = useRef<any>(null);

  useEffect(() => {
    fetchMappings();
  }, []);

  const fetchMappings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/common/config-mapping");
      const json = await res.json();
      setData(json.data ?? []);
    } catch (error) {
      console.error("Failed to fetch config mappings", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header section with dynamic central import/export controls */}
      <div className="rounded-3xl border bg-white p-6 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Database className="text-blue-600 h-7 w-7" />
            Config & Mapping Manager
          </h1>
          <p className="text-sm text-slate-500 font-semibold mt-1">Centralized configuration variables and mappings</p>
        </div>

        <div className="flex items-center gap-3">
          <ImportExportControls
            entity="config-mapping"
            title="Config & Mapping"
            filename="ConfigMappings"
            columnSettings={columnSettings}
            data={data}
            tableRef={tableRef}
            onSuccess={fetchMappings}
          />
          <Button size="icon" className="rounded-full bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Basic Data Grid representing the list */}
      <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-xs">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            <span className="text-sm font-semibold text-slate-400">Loading mappings...</span>
          </div>
        ) : data.length === 0 ? (
          <div className="py-20 text-center text-slate-400 font-semibold">
            No mapping records found in the database.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100 sticky top-0">
                <tr>
                  <th className="px-5 py-3">Mapping ID</th>
                  <th className="px-5 py-3">Config Code</th>
                  <th className="px-5 py-3">Config Name</th>
                  <th className="px-5 py-3">Mapping Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {data.map((item) => (
                  <tr key={item.CNFG_MPPNG_ID} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-slate-500">{item.CNFG_MPPNG_ID}</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-800">{item.CNFG_CD}</td>
                    <td className="px-5 py-3.5 font-medium text-slate-600">{item.CNFG_NM}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-400">{item.CNFG_VAL}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
