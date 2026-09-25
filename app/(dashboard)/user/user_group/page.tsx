"use client";

import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import ResourceListPage from "@/components/resource/ResourceListPage";

interface GroupRow {
  id: number;
  name: string;
  domainName: string | null;
  brandName: string | null;
  memberCount: number;
  requestedBy: string | null;
}

/** CI user/user_group::index() — list of user_group_vw. */
export default function UserGroupPage() {
  const router = useRouter();
  return (
    <ResourceListPage<GroupRow>
      title="User Group"
      entity="user-group"
      apiPath="/api/user/user_group"
      basePath="/user/user_group"
      getId={(r) => r.id}
      searchPlaceholder="Search group name..."
      extraRowActions={[{ label: "Group Roles", icon: ShieldCheck, onClick: (r) => router.push(`/user/user_group_role?groupId=${r.id}`) }]}
      columns={[
        { key: "name", header: "User Group", sortKey: "USER_GRP_NM" },
        { key: "domainName", header: "Domain", sortKey: "DMN_ID" },
        { key: "brandName", header: "Brand", sortKey: "OA_BRAND_ID" },
        { key: "memberCount", header: "Members" },
        { key: "requestedBy", header: "Requested By" },
      ]}
    />
  );
}
