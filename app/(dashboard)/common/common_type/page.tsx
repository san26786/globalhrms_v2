"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { common_type } from "../../../generated/prisma/client";
import { columns } from "./components/commonTypeColumns";
import { DataTable } from "./components/CommonTypeTable";
import BreadcrumbHeader from "./components/BreadcrumbHeader";

export default function CommonType() {
  const [commonTypes, setCommonTypes] = useState<common_type[]>([]);
  const router = useRouter();

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
    <div className="container mx-auto p-4">
      <BreadcrumbHeader />
      <DataTable columns={columns} data={commonTypes} />
    </div>
  );
}