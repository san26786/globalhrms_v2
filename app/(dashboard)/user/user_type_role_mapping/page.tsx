"use client";

import ResourceListPage from "@/components/resource/ResourceListPage";

interface MappingRow {
  id: number;
  appName: string | null;
  userTypeName: string | null;
  roleName: string | null;
  permissionClassName: string | null;
}

/** CI user/user_type_role_mapping::index() — system administrator only. */
export default function UserTypeRoleMappingPage() {
  return (
    <ResourceListPage<MappingRow>
      title="User Type and Role Mapping"
      entity="user-type-role-mapping"
      apiPath="/api/user/user_type_role_mapping"
      basePath="/user/user_type_role_mapping"
      getId={(r) => r.id}
      searchPlaceholder="Search codes..."
      columns={[
        { key: "appName", header: "Application", sortKey: "APP_ID" },
        { key: "userTypeName", header: "User Type", sortKey: "USER_TYPE_ID" },
        { key: "roleName", header: "Role", sortKey: "ROLE_ID" },
        { key: "permissionClassName", header: "Permission Class", sortKey: "PERMISSION_CLASS_ID" },
      ]}
    />
  );
}
