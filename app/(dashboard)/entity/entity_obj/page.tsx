"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";

import ResourceListPage from "@/components/resource/ResourceListPage";
import ExistsBadge from "../_components/ExistsBadge";

interface EntityObjRow {
  id: number;
  objTyp: string;
  objNm: string;
  existsInDb: boolean;
  dbObjectType: string | null;
}

const TYPE_FILTERS = ["", "BASE TABLE", "VIEW"] as const;

/** CI entity/entity_obj::index() — list of entity_obj_vw with name search and type filter. */
export default function EntityObjPage() {
  const router = useRouter();
  const [objTyp, setObjTyp] = useState<(typeof TYPE_FILTERS)[number]>("");

  return (
    <div>
      <div className="container mx-auto flex items-center gap-2 px-4 pt-4 text-sm text-slate-600">
        <label htmlFor="objTypFilter">Object type</label>
        <select
          id="objTypFilter"
          className="h-9 rounded-lg border border-gray-300 bg-white px-3"
          value={objTyp}
          onChange={(e) => setObjTyp(e.target.value as (typeof TYPE_FILTERS)[number])}
        >
          {TYPE_FILTERS.map((t) => (
            <option key={t} value={t}>
              {t || "All"}
            </option>
          ))}
        </select>
      </div>
      <ResourceListPage<EntityObjRow>
        title="Entity Object"
        entity="entity-obj"
        objectName="entity_obj_vw"
        apiPath="/api/entity/entity_obj"
        basePath="/entity/entity_obj"
        getId={(r) => r.id}
        params={objTyp ? { objTyp } : undefined}
        searchPlaceholder="Search object name..."
        extraRowActions={[{ label: "Details", icon: Eye, onClick: (r) => router.push(`/entity/entity_obj/${r.id}`) }]}
        columns={[
          { key: "objNm", header: "Object Name", sortKey: "OBJ_NM" },
          { key: "objTyp", header: "Object Type", sortKey: "OBJ_TYP" },
          { key: "existsInDb", header: "In Database", cell: (r) => <ExistsBadge exists={r.existsInDb} type={r.dbObjectType} /> },
        ]}
      />
    </div>
  );
}
