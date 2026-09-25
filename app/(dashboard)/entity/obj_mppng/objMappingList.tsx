"use client";

import ResourceListPage from "@/components/resource/ResourceListPage";

interface ObjMappingRow {
  id: number;
  srcLyrName: string | null;
  srcObjName: string | null;
  trgtLyrName: string | null;
  trgtObjName: string | null;
}

/** CI entity/obj_mppng::index() — optionally filtered by source object (entity Mapping tab). */
export default function ObjMappingList({ srcObjId, title = "Object Mapping" }: { srcObjId?: number; title?: string }) {
  return (
    <ResourceListPage<ObjMappingRow>
      title={title}
      entity="obj-mppng"
      apiPath="/api/entity/obj_mppng"
      basePath="/entity/obj_mppng"
      getId={(r) => r.id}
      params={srcObjId ? { srcObjId: String(srcObjId) } : undefined}
      columns={[
        { key: "id", header: "ID", sortKey: "OBJ_MPPNG_ID" },
        { key: "srcLyrName", header: "Source Layer", sortKey: "SRC_LYR_ID" },
        { key: "srcObjName", header: "Source Object", sortKey: "SRC_OBJ_ID" },
        { key: "trgtLyrName", header: "Target Layer", sortKey: "TRGT_LYR_ID" },
        { key: "trgtObjName", header: "Target Object", sortKey: "TRGT_OBJ_ID" },
      ]}
    />
  );
}
