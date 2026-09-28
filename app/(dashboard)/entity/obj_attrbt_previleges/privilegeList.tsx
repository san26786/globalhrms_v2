"use client";

import ResourceListPage from "@/components/resource/ResourceListPage";
import HelpNote from "../_components/HelpNote";

interface PrivilegeRow {
  id: number;
  objName: string | null;
  objAttrbtName: string | null;
  brandName: string | null;
}

export const PRIVILEGES_NOTE =
  "Object attribute privileges are configuration only: they are stored but not yet enforced anywhere (the CI application never enforced them either). Enforcement is planned future work.";

/** CI entity/obj_attrbt_previleges::index() — admin: own organisation. Optionally filtered by object. */
export default function PrivilegeList({ objId, title = "Object Attribute Privileges" }: { objId?: number; title?: string }) {
  return (
    <div className="space-y-4">
      <div className="container mx-auto px-4 pt-4">
        <HelpNote>{PRIVILEGES_NOTE}</HelpNote>
      </div>
      <ResourceListPage<PrivilegeRow>
        title={title}
        entity="obj-attrbt-previleges"
        objectName="obj_attrbt_previleges_vw"
        apiPath="/api/entity/obj_attrbt_previleges"
        basePath="/entity/obj_attrbt_previleges"
        getId={(r) => r.id}
        params={objId ? { objId: String(objId) } : undefined}
        columns={[
          { key: "objName", header: "Object", sortKey: "OBJ_ID" },
          { key: "objAttrbtName", header: "Object Attribute", sortKey: "OBJ_ATTRBT_ID" },
          { key: "brandName", header: "Brand", sortKey: "OA_BRAND_ID" },
        ]}
      />
    </div>
  );
}
