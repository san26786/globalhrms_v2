"use client";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import { useOptions } from "@/lib/lookups/useOptions";
import { idOrEmpty, useUserAdminMeta } from "../_shared/formKit";

/**
 * CI role_master initForm: Role Name, Description, Authority Level, Domain, Is Admin, Is Assignable.
 * Domains are those of the role's brand; a system admin first picks the brand (add).
 */
interface RoleForm {
  roleName: string;
  description: string;
  authorityLevel: string;
  domainId: string;
  isAdminRole: boolean;
  isAssignable: boolean;
  oaBrandId: string;
}

interface RoleDto {
  roleName: string;
  description: string | null;
  authorityLevel: number | null;
  domainId: number | null;
  isAdminRole: boolean;
  isAssignable: boolean;
  oaBrandId: number;
}

function useRoleFields(values: RoleForm, mode: "add" | "edit"): DynamicField[] {
  const meta = useUserAdminMeta();
  const sysAdminAdd = mode === "add" && meta?.adminLevel === 2;
  const brands = useOptions(sysAdminAdd ? "/api/lookups/brands" : null);
  const brandId = mode === "edit" || sysAdminAdd ? values.oaBrandId : "";
  const domains = useOptions(
    meta ? `/api/user/options/domains?level=brand${brandId ? `&brandId=${brandId}` : ""}` : null,
  );
  return [
    ...(sysAdminAdd ? [{ name: "oaBrandId", label: "Brand", type: "select", options: brands.options } as DynamicField] : []),
    { name: "roleName", label: "Role Name", type: "text", required: true },
    { name: "description", label: "Role Description", type: "textarea", required: true },
    { name: "authorityLevel", label: "Authority Level", type: "number", required: true },
    { name: "domainId", label: "Domain Name", type: "select", required: true, options: domains.options },
    { name: "isAdminRole", label: "Is Admin", type: "checkbox" },
    { name: "isAssignable", label: "Is Assignable", type: "checkbox" },
  ];
}

const useAddFields = (v: RoleForm) => useRoleFields(v, "add");
const useEditFields = (v: RoleForm) => useRoleFields(v, "edit");

export default function RoleFormPage({ mode, id }: { mode: "add" | "edit"; id?: string }) {
  return (
    <ResourceFormPage<RoleForm, RoleDto>
      title={mode === "add" ? "New Role Master" : "Edit Role Master"}
      breadcrumb={["User", "Role Master"]}
      mode={mode}
      id={id}
      apiPath="/api/user/role_master"
      basePath="/user/role_master"
      useFields={mode === "add" ? useAddFields : useEditFields}
      defaultValues={{ roleName: "", description: "", authorityLevel: "", domainId: "", isAdminRole: false, isAssignable: true, oaBrandId: "" }}
      toForm={(dto) => ({
        roleName: dto.roleName,
        description: dto.description ?? "",
        authorityLevel: dto.authorityLevel !== null ? String(dto.authorityLevel) : "",
        domainId: idOrEmpty(dto.domainId),
        isAdminRole: dto.isAdminRole,
        isAssignable: dto.isAssignable,
        oaBrandId: String(dto.oaBrandId),
      })}
      toPayload={(v) => ({ ...v, oaBrandId: mode === "add" ? v.oaBrandId || undefined : undefined })}
    />
  );
}
