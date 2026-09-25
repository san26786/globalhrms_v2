"use client";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import { useOptions } from "@/lib/lookups/useOptions";
import { useUserAdminMeta } from "../_shared/formKit";

/** CI user_group_role initForm: User Group and Role (both of the record's brand; sysadmin picks the brand on add). */
interface GroupRoleForm {
  groupId: string;
  roleId: string;
  oaBrandId: string;
}

interface GroupRoleDto {
  groupId: number;
  roleId: number;
  oaBrandId: number;
}

function useGroupRoleFields(values: GroupRoleForm, mode: "add" | "edit"): DynamicField[] {
  const meta = useUserAdminMeta();
  const sysAdminAdd = mode === "add" && meta?.adminLevel === 2;
  const brands = useOptions(sysAdminAdd ? "/api/lookups/brands" : null);
  const brandQuery = (mode === "edit" || sysAdminAdd) && values.oaBrandId ? `?brandId=${values.oaBrandId}` : "";
  const groups = useOptions(meta ? `/api/user/options/groups${brandQuery}` : null);
  const roles = useOptions(meta ? `/api/user/options/roles${brandQuery}` : null);
  return [
    ...(sysAdminAdd ? [{ name: "oaBrandId", label: "Brand", type: "select", options: brands.options } as DynamicField] : []),
    { name: "groupId", label: "User Group", type: "select", required: true, options: groups.options },
    { name: "roleId", label: "Role", type: "select", required: true, options: roles.options },
  ];
}

const useAddFields = (v: GroupRoleForm) => useGroupRoleFields(v, "add");
const useEditFields = (v: GroupRoleForm) => useGroupRoleFields(v, "edit");

export default function GroupRoleFormPage({ mode, id }: { mode: "add" | "edit"; id?: string }) {
  return (
    <ResourceFormPage<GroupRoleForm, GroupRoleDto>
      title={mode === "add" ? "New Group Role" : "Edit Group Role"}
      breadcrumb={["User", "User Group Role"]}
      mode={mode}
      id={id}
      apiPath="/api/user/user_group_role"
      basePath="/user/user_group_role"
      useFields={mode === "add" ? useAddFields : useEditFields}
      defaultValues={{ groupId: "", roleId: "", oaBrandId: "" }}
      toForm={(dto) => ({ groupId: String(dto.groupId), roleId: String(dto.roleId), oaBrandId: String(dto.oaBrandId) })}
      toPayload={(v) => ({ ...v, oaBrandId: mode === "add" ? v.oaBrandId || undefined : undefined })}
    />
  );
}
