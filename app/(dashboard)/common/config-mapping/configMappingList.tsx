"use client";

import ResourceListPage, { type ResourceListColumn } from "@/components/resource/ResourceListPage";

interface MappingRow {
  id: number;
  mappingTypeName: string | null;
  sourceName: string | null;
  sourceCode: string | null;
  targetName: string | null;
  targetCode: string | null;
}

/** CI common/config_mapping_dtl::index($config_typ) — listview of config_mapping_dtl_vw. */
export default function ConfigMappingList({ typeId }: { typeId: number | null }) {
  const query = typeId ? `?typeId=${typeId}` : "";
  const columns: ResourceListColumn<MappingRow>[] = [
    ...(typeId ? [] : [{ key: "mappingTypeName", header: "Mapping Type", sortKey: "CNFG_MPPNG_TYP_ID" } satisfies ResourceListColumn<MappingRow>]),
    { key: "sourceName", header: "Source Entity", sortKey: "SRC_ENTTY_ID" },
    { key: "sourceCode", header: "Source Code", sortKey: "SRC_ENTITY_CD" },
    { key: "targetName", header: "Target Entity", sortKey: "TRGT_ENTTY_ID" },
    { key: "targetCode", header: "Target Code", sortKey: "TRGT_ENTITY_CD" },
  ];

  return (
    <ResourceListPage<MappingRow>
      title="Config Mapping Details"
      entity="config-mapping"
      apiPath="/api/common/config-mapping"
      basePath="/common/config-mapping"
      params={typeId ? { typeId: String(typeId) } : undefined}
      addHref={`/common/config-mapping/add-config-mapping${query}`}
      editHref={(r) => `/common/config-mapping/edit-config-mapping/${r.id}${query}`}
      getId={(r) => r.id}
      searchPlaceholder="Search source or target code..."
      columns={columns}
    />
  );
}
