"use client";

import ResourceListPage from "@/components/resource/ResourceListPage";

interface AttributeMappingRow {
  id: number;
  objMppngId: number;
  srcObjName: string | null;
  srcAttributeName: string | null;
  trgObjName: string | null;
  trgAttributeName: string | null;
}

/** CI entity/entity_obj_attrbt_mppng::index() (entity_obj_attrbt_mppng_vw). */
export default function EntityObjAttrbtMppngPage() {
  return (
    <ResourceListPage<AttributeMappingRow>
      title="Entity Object Attribute Mapping"
      entity="entity-obj-attrbt-mppng"
      apiPath="/api/entity/entity_obj_attrbt_mppng"
      basePath="/entity/entity_obj_attrbt_mppng"
      getId={(r) => r.id}
      columns={[
        { key: "objMppngId", header: "Object Mapping", sortKey: "OBJ_MPPNG_ID" },
        { key: "srcObjName", header: "Source Object" },
        { key: "srcAttributeName", header: "Source Attribute" },
        { key: "trgObjName", header: "Target Object" },
        { key: "trgAttributeName", header: "Target Attribute" },
      ]}
    />
  );
}
