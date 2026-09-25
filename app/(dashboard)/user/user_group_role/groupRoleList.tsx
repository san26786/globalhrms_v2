"use client";

import ResourceListPage from "@/components/resource/ResourceListPage";

interface GroupRoleRow {
  id: number;
  groupName: string | null;
  roleName: string | null;
  brandName: string | null;
}

export default function GroupRoleList({ groupId }: { groupId?: string }) {
  return (
    <ResourceListPage<GroupRoleRow>
      title="User Group Role"
      entity="user-group-role"
      apiPath="/api/user/user_group_role"
      basePath="/user/user_group_role"
      params={groupId ? { groupId } : undefined}
      getId={(r) => r.id}
      columns={[
        { key: "groupName", header: "User Group", sortKey: "USER_GRP_ID" },
        { key: "roleName", header: "Role", sortKey: "ROLE_ID" },
        { key: "brandName", header: "Brand" },
      ]}
    />
  );
}
