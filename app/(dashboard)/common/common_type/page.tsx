"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { common_type } from "@/generated/prisma/client";
import { columns } from "@/(dashboard)/common/common_type/components/commonTypeColumns";
import { DataTable } from "@/(dashboard)/common/common_type/components/CommonTypeTable";
import BreadcrumbHeader from "@/(dashboard)/common/common_type/components/BreadcrumbHeader";

const columnSettings = [
  { systemName: "TYP_ID", displayName: "Type ID", visibleInList: true, visibleInForm: true },
  { systemName: "TYP_CD", displayName: "Type Code", visibleInList: true, visibleInForm: true },
  { systemName: "TYP_NM", displayName: "Type Name", visibleInList: true, visibleInForm: true },
  { systemName: "VIEW_NM", displayName: "View Name", visibleInList: true, visibleInForm: true }
];

export default function CommonType() {
  const [commonTypes, setCommonTypes] = useState<common_type[]>([]);
  const router = useRouter();
  const tableRef = useRef<any>(null);

  useEffect(() => {
    fetchCommonTypes();
  }, []);

  const fetchCommonTypes = async () => {
    try {
      const res = await fetch("/api/common/common_type");
      const json = await res.json();
      setCommonTypes(json.data ?? []);
    } catch (error) {
      console.error("Failed to fetch common types", error);
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <BreadcrumbHeader 
        entity="common-type"
        title="Common Type"
        filename="CommonTypes"
        columnSettings={columnSettings}
        data={commonTypes}
        tableRef={tableRef}
        onSuccess={fetchCommonTypes}
      />
      <DataTable 
        columns={columns} 
        data={commonTypes} 
        onTableInstance={(instance) => { tableRef.current = instance; }}
      />
    </div>
  );
}