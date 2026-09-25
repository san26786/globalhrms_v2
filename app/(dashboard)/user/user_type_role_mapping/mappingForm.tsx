"use client";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import { useOptions } from "@/lib/lookups/useOptions";

/**
 * CI user_type_role_mapping initForm: Application (HTRHA masters) → User Type / Role /
 * Permission Class of that application (CI getUserType / getRole / getPermissionClass).
 */
interface MappingForm {
  appId: string;
  userTypeId: string;
  roleId: string;
  permissionClassId: string;
}

interface MappingDto {
  appId: number;
  userTypeId: number;
  roleId: number;
  permissionClassId: number;
}

function useMappingFields(values: MappingForm): DynamicField[] {
  const apps = useOptions("/api/lookups/masters?typeCode=HTRHA");
  const q = values.appId ? `?appId=${values.appId}` : null;
  const userTypes = useOptions(q && `/api/user/options/user-types${q}`);
  const roles = useOptions(q && `/api/user/options/app-roles${q}`);
  const classes = useOptions(q && `/api/user/options/permission-classes${q}`);
  return [
    { name: "appId", label: "Application", type: "select", required: true, options: apps.options },
    { name: "userTypeId", label: "User Type", type: "select", required: true, options: userTypes.options },
    { name: "roleId", label: "Role", type: "select", required: true, options: roles.options },
    { name: "permissionClassId", label: "Permission Class", type: "select", required: true, options: classes.options },
  ];
}

export default function MappingFormPage({ mode, id }: { mode: "add" | "edit"; id?: string }) {
  return (
    <ResourceFormPage<MappingForm, MappingDto>
      title={mode === "add" ? "New User Mapping" : "Edit User Mapping"}
      breadcrumb={["User", "User Type and Role Mapping"]}
      mode={mode}
      id={id}
      apiPath="/api/user/user_type_role_mapping"
      basePath="/user/user_type_role_mapping"
      useFields={useMappingFields}
      defaultValues={{ appId: "", userTypeId: "", roleId: "", permissionClassId: "" }}
      toForm={(dto) => ({
        appId: String(dto.appId),
        userTypeId: String(dto.userTypeId),
        roleId: String(dto.roleId),
        permissionClassId: String(dto.permissionClassId),
      })}
    />
  );
}
