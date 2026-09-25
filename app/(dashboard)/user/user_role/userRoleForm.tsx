"use client";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import { useOptions } from "@/lib/lookups/useOptions";

/** CI user_role initForm: Role (of the user's brand) for the user of the tab. */
interface UserRoleForm {
  userId: string;
  roleId: string;
}

interface UserRoleDto {
  userId: number;
  roleId: number;
}

function useUserRoleFields(values: UserRoleForm, mode: "add" | "edit"): DynamicField[] {
  const users = useOptions("/api/user/options/users");
  const roles = useOptions(values.userId ? `/api/user/options/roles?userId=${values.userId}` : null);
  return [
    { name: "userId", label: "User", type: "select", required: true, options: users.options, disabled: mode === "edit" },
    { name: "roleId", label: "Role", type: "select", required: true, options: roles.options },
  ];
}

const useAddFields = (v: UserRoleForm) => useUserRoleFields(v, "add");
const useEditFields = (v: UserRoleForm) => useUserRoleFields(v, "edit");

export default function UserRoleFormPage({ mode, id, userId }: { mode: "add" | "edit"; id?: string; userId?: string }) {
  return (
    <ResourceFormPage<UserRoleForm, UserRoleDto>
      title={mode === "add" ? "New User Role" : "Edit User Role"}
      breadcrumb={["User", "User Role"]}
      mode={mode}
      id={id}
      apiPath="/api/user/user_role"
      basePath={userId ? `/user/user_role?userId=${userId}` : "/user/user_role"}
      useFields={mode === "add" ? useAddFields : useEditFields}
      defaultValues={{ userId: userId ?? "", roleId: "" }}
      toForm={(dto) => ({ userId: String(dto.userId), roleId: String(dto.roleId) })}
    />
  );
}
