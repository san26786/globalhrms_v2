"use client";

import ResourceListPage from "@/components/resource/ResourceListPage";

interface AuthorityRow {
  id: number;
  authorityLevelName: string | null;
  value: string | null;
  brandName: string | null;
}

/** CI authoritylevel/authoritylevel::index() — list of authority_level_vw (scoped by brand). */
export default function AuthorityLevelPage() {
  return (
    <ResourceListPage<AuthorityRow>
      title="Authority Level"
      entity="authority-level"
      objectName="authority_level_vw"
      apiPath="/api/user/authoritylevel"
      basePath="/user/authoritylevel"
      getId={(r) => r.id}
      searchPlaceholder="Search value..."
      columns={[
        { key: "authorityLevelName", header: "Authority Level", sortKey: "AUTHORITY_LEVEL_ID" },
        { key: "value", header: "Authority Value", sortKey: "VALUE" },
        { key: "brandName", header: "Brand", sortKey: "OA_BRAND_ID" },
      ]}
    />
  );
}
