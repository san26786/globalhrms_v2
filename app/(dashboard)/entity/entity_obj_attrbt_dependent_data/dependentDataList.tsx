"use client";

import ResourceListPage from "@/components/resource/ResourceListPage";

interface DependentDataRow {
  id: number;
  objNm: string;
  objAttrbtNm: string;
  objAttrbtSeq: number;
  objTypeCode: string | null;
  objFieldType: string;
  isVisible: boolean;
}

/** CI entity/entity_obj_attrbt_dependent_data::index() — list + edit only (CI had no add/delete). */
export default function DependentDataList({ objNm, title = "Entity Object Attribute Dependent Data" }: { objNm?: string; title?: string }) {
  return (
    <ResourceListPage<DependentDataRow>
      title={title}
      entity="entity-obj-attrbt-dependent-data"
      apiPath="/api/entity/entity_obj_attrbt_dependent_data"
      basePath="/entity/entity_obj_attrbt_dependent_data"
      getId={(r) => r.id}
      params={objNm ? { objNm } : undefined}
      searchPlaceholder="Search object, attribute or type code..."
      columns={[
        ...(objNm ? [] : [{ key: "objNm" as const, header: "Object Name", sortKey: "OBJ_NM" }]),
        { key: "objAttrbtNm", header: "Attribute Name", sortKey: "OBJ_ATTRBT_NM" },
        { key: "objAttrbtSeq", header: "Sequence", sortKey: "OBJ_ATTRBT_SEQ" },
        { key: "objTypeCode", header: "Type Code" },
        { key: "objFieldType", header: "Field Type" },
        { key: "isVisible", header: "Visible", cell: (r) => (r.isVisible ? "Yes" : "No") },
      ]}
    />
  );
}
