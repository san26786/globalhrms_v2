"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, ThumbsDown, ThumbsUp, UserCog } from "lucide-react";
import { toast } from "sonner";

import ResourceListPage from "@/components/resource/ResourceListPage";
import type { RowAction } from "@/components/DataTable/types";
import { useUserAdminMeta } from "../_shared/formKit";
import { changeUserStatus } from "./userActions";

interface UserRow {
  id: number;
  userName: string;
  regEmail: string;
  fullName: string | null;
  domainName: string | null;
  organisation: string | null;
  brandName: string | null;
  statusName: string | null;
  userTypeName: string | null;
  roleNames: string;
  isAdmin: boolean;
  lastLoginAt: string | null;
}

/**
 * CI user/user_master::index() — list of user_mst_vw. Admins also get CI's list actions
 * "Activate User", "Deactivate User" and "Activate Suspended User" (per row here).
 */
export default function UserMasterPage() {
  const router = useRouter();
  const meta = useUserAdminMeta();
  const [version, setVersion] = useState(0);

  const act = (action: "activate" | "deactivate" | "activate-suspended") => async (row: UserRow) => {
    try {
      toast.success((await changeUserStatus(action, [row.id])).message);
      setVersion((v) => v + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    }
  };

  const extraRowActions: RowAction<UserRow>[] = [
    { label: "User Roles", icon: UserCog, onClick: (row) => router.push(`/user/user_role?userId=${row.id}`) },
    ...(meta?.canChangeStatus
      ? [
          { label: "Activate User", icon: ThumbsUp, onClick: act("activate") },
          { label: "Deactivate User", icon: ThumbsDown, onClick: act("deactivate") },
          { label: "Activate Suspended User", icon: CheckCheck, onClick: act("activate-suspended") },
        ]
      : []),
  ];

  return (
    <ResourceListPage<UserRow>
      key={version}
      title="User Master"
      entity="user-master"
      apiPath="/api/user/user_master"
      basePath="/user/user_master"
      getId={(r) => r.id}
      searchPlaceholder="Search user name, email or reference..."
      extraRowActions={extraRowActions}
      columns={[
        { key: "userName", header: "User Name", sortKey: "USER_NAME" },
        { key: "regEmail", header: "Reg Email", sortKey: "REG_EMAIL_ID" },
        { key: "domainName", header: "Domain", sortKey: "DMN_ID" },
        { key: "organisation", header: "Organisation" },
        { key: "brandName", header: "Brand", sortKey: "OA_BRAND_ID" },
        { key: "roleNames", header: "Roles" },
        { key: "userTypeName", header: "User Type" },
        { key: "statusName", header: "Status", sortKey: "USER_STATUS_ID" },
        { key: "isAdmin", header: "Admin", cell: (r) => (r.isAdmin ? "Yes" : "No") },
        {
          key: "lastLoginAt",
          header: "Last Login",
          sortKey: "LAST_LOGIN_AT",
          cell: (r) => (r.lastLoginAt ? new Date(r.lastLoginAt).toLocaleString() : ""),
        },
      ]}
    />
  );
}
