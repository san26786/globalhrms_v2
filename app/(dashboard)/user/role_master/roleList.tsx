"use client";

import ResourceListPage from "@/components/resource/ResourceListPage";

interface RoleRow {
  id: number;
  roleName: string;
  description: string | null;
  authorityLevel: number | null;
  domainName: string | null;
  brandName: string | null;
  isAdminRole: boolean;
  isAssignable: boolean;
  isPredefined: boolean;
}

const yesNo = (v: boolean) => (v ? "Yes" : "No");

export default function RoleList({ domainId }: { domainId?: string }) {
  return (
    <ResourceListPage<RoleRow>
      title="Role Master"
      entity="role-master"
      apiPath="/api/user/role_master"
      basePath="/user/role_master"
      params={domainId ? { domainId } : undefined}
      getId={(r) => r.id}
      searchPlaceholder="Search role name, code or description..."
      columns={[
        { key: "roleName", header: "Role Name", sortKey: "ROLE_NM" },
        { key: "description", header: "Role Description" },
        { key: "authorityLevel", header: "Authority Level", sortKey: "AUTHORITY_LEVEL" },
        { key: "domainName", header: "Domain", sortKey: "DMN_ID" },
        { key: "brandName", header: "Brand", sortKey: "OA_BRAND_ID" },
        { key: "isAdminRole", header: "Admin Role", cell: (r) => yesNo(r.isAdminRole) },
        { key: "isAssignable", header: "Assignable", cell: (r) => yesNo(r.isAssignable) },
        { key: "isPredefined", header: "Predefined", cell: (r) => yesNo(r.isPredefined) },
      ]}
    />
  );
}
