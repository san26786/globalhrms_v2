"use client";

import ResourceListPage from "@/components/resource/ResourceListPage";
import HelpNote from "../_components/HelpNote";

interface DisplayDetailRow {
  id: number;
  objNm: string;
  objAttrbtNm: string;
  objAttrbtDsplyNm: string;
  isVisibleForListview: boolean;
  isVisibleForFormview: boolean;
  brandName: string | null;
  isSystemRow: boolean;
}

/** CI entity/entity_obj_attrbt_dsply_dtl::index() — admin: own organisation; user: own rows. */
export default function EntityObjAttrbtDsplyDtlPage() {
  return (
    <div>
      <div className="container mx-auto px-4 pt-4">
        <HelpNote>
          Per-brand column labels and visibility. The same settings can be edited for a whole object on the
          entity&apos;s Display tab (Entity Object → Details → Display).
        </HelpNote>
      </div>
      <ResourceListPage<DisplayDetailRow>
        title="Entity Object Attribute Display"
        entity="entity-obj-attrbt-dsply-dtl"
        apiPath="/api/entity/entity_obj_attrbt_dsply_dtl"
        basePath="/entity/entity_obj_attrbt_dsply_dtl"
        getId={(r) => r.id}
        searchPlaceholder="Search object, attribute or display name..."
        columns={[
          { key: "objNm", header: "Object Name", sortKey: "OBJ_NM" },
          { key: "objAttrbtNm", header: "Attribute Name", sortKey: "OBJ_ATTRBT_NM" },
          { key: "objAttrbtDsplyNm", header: "Display Name", sortKey: "OBJ_ATTRBT_DSPLY_NM" },
          { key: "isVisibleForListview", header: "List View", cell: (r) => (r.isVisibleForListview ? "Yes" : "No") },
          { key: "isVisibleForFormview", header: "Form View", cell: (r) => (r.isVisibleForFormview ? "Yes" : "No") },
          { key: "brandName", header: "Brand", sortKey: "OA_BRAND_ID", cell: (r) => (r.isSystemRow ? "System" : (r.brandName ?? "-")) },
        ]}
      />
    </div>
  );
}
