"use client";

import Link from "next/link";
import { Plus, UserPen } from "lucide-react";
import ResourceListPage from "@/components/resource/ResourceListPage";
import { Button } from "@/components/ui/button";

interface UserRoleRow {
  id: number;
  userName: string | null;
  roleName: string | null;
  brandName: string | null;
}

/**
 * Roles of one user. The standard Add button opens the form without a user; the tab's own
 * "Add role for this user" link pre-selects the user (CI newUserRole/{userId}).
 */
export default function UserRoleList({ userId }: { userId?: string }) {
  return (
    <>
      {userId && (
        <div className="container mx-auto flex gap-2 px-4 pt-4">
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link href={`/user/user_master/edit/${userId}`}>
              <UserPen className="mr-1 h-4 w-4" /> User Master
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link href={`/user/user_role/add?userId=${userId}`}>
              <Plus className="mr-1 h-4 w-4" /> Add role for this user
            </Link>
          </Button>
        </div>
      )}
      <ResourceListPage<UserRoleRow>
        title="User Role"
        entity="user-role"
        objectName="user_role_vw"
        apiPath="/api/user/user_role"
        basePath="/user/user_role"
        params={userId ? { userId } : undefined}
        getId={(r) => r.id}
        columns={[
          // Bound to user_role_vw attributes: labels / list visibility follow the Form Settings.
          { key: "roleName", header: "Role Name", attribute: "ROLE_NM", sortKey: "ROLE_ID" },
          { key: "userName", header: "User Name", attribute: "USER_NAME", sortKey: "USER_ID" },
          { key: "brandName", header: "Brand", attribute: "OA_BRAND_CD" },
        ]}
      />
    </>
  );
}
