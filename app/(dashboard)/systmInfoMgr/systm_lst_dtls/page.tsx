"use client";

import ResourceListPage from "@/components/resource/ResourceListPage";

interface ListDetailRow {
  id: number;
  tableName: string;
  lastNumber: number;
}

/** CI systmInfoMgr/systm_lst_dtls::index() — list view of systm_lst_dtl_vw. */
export default function SystemListDetailsPage() {
  return (
    <ResourceListPage<ListDetailRow>
      title="System List Details"
      entity="systm-lst-dtls"
      apiPath="/api/systmInfoMgr/systm_lst_dtls"
      basePath="/systmInfoMgr/systm_lst_dtls"
      getId={(r) => r.id}
      searchPlaceholder="Search table name..."
      columns={[
        { key: "tableName", header: "Table Name", sortKey: "TBL_NM" },
        { key: "lastNumber", header: "Last Number", sortKey: "LST_NMBR" },
      ]}
    />
  );
}
