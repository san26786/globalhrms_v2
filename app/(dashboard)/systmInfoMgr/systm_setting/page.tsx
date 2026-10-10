"use client";

import ResourceListPage from "@/components/resource/ResourceListPage";

interface SettingRow {
  id: number;
  attributeName: string | null;
  refTypeName: string | null;
  refName: string | null;
  refCode: string | null;
  settingValue: string;
  brandName: string | null;
  isEnabled: boolean;
}

/** CI systmInfoMgr/systm_setting::index() — list view of system_setting_vw. */
export default function SystemSettingPage() {
  return (
    <ResourceListPage<SettingRow>
      title="System Setting"
      entity="systm-setting"
      objectName="system_setting_vw"
      apiPath="/api/systmInfoMgr/systm_setting"
      basePath="/systmInfoMgr/systm_setting"
      getId={(r) => r.id}
      searchPlaceholder="Search reference code, value or description..."
      columns={[
        { key: "attributeName", header: "System Attribute", sortKey: "SYSTM_ATTRBUTE_ID" },
        { key: "refTypeName", header: "Reference Type" },
        { key: "refName", header: "Reference" },
        { key: "refCode", header: "Reference Code", sortKey: "REF_CD" },
        { key: "settingValue", header: "Setting Value" },
        { key: "brandName", header: "Brand", sortKey: "OA_BRAND_ID" },
        { key: "isEnabled", header: "Enabled", cell: (r) => (r.isEnabled ? "Yes" : "No") },
      ]}
    />
  );
}
