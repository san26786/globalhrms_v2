"use client";

import { Database } from "lucide-react";
import { useRouter } from "next/navigation";
import ResourceListPage from "@/components/resource/ResourceListPage";
import { typeQuery } from "@/components/common/master-data-form";

interface EntityRow {
  id: number;
  typeId: number;
  code: string;
  name: string;
  viewName: string | null;
  dataType: string | null;
  parentTypeName: string | null;
  userCanCreateData: boolean;
}

/**
 * CI common/common_type::index() — System Entities (system_entities_vw). CI's "Independent Master"
 * tab of a type is the row action "Master Data" (→ /common/master-data?typeId=…).
 */
export default function CommonTypePage() {
  const router = useRouter();
  return (
    <ResourceListPage<EntityRow>
      title="System Entities"
      entity="common-type"
      objectName="system_entities_vw"
      apiPath="/api/common/common_type"
      basePath="/common/common_type"
      getId={(r) => r.id}
      searchPlaceholder="Search type code, name or view..."
      extraRowActions={[
        { label: "Master Data", icon: Database, onClick: (r) => router.push(`/common/master-data${typeQuery(r.typeId)}`) },
      ]}
      columns={[
        { key: "typeId", header: "Type Id", sortKey: "TYP_ID" },
        { key: "code", header: "Type Code", sortKey: "TYP_CD" },
        { key: "name", header: "Type Name", sortKey: "TYP_NM" },
        { key: "viewName", header: "View Name", sortKey: "VIEW_NM" },
        { key: "dataType", header: "Data Type", sortKey: "TABLE_TYPE" },
        { key: "parentTypeName", header: "Parent Type" },
        { key: "userCanCreateData", header: "User Can Create Data", cell: (r) => (r.userCanCreateData ? "Yes" : "No") },
      ]}
    />
  );
}
