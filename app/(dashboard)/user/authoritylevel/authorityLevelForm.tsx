"use client";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import { useOptions } from "@/lib/lookups/useOptions";
import { useUserAdminMeta } from "../_shared/formKit";

/** CI authoritylevel initForm: Authority Level (masters of type 40), Authority Value; Brand for the sysadmin (add). */
interface AuthorityForm {
  authorityLevelId: string;
  value: string;
  oaBrandId: string;
}

interface AuthorityDto {
  authorityLevelId: number | null;
  value: string | null;
  oaBrandId: number | null;
}

function useAuthorityFields(mode: "add" | "edit"): DynamicField[] {
  const meta = useUserAdminMeta();
  const sysAdminAdd = mode === "add" && meta?.adminLevel === 2;
  const levels = useOptions("/api/lookups/masters?typeId=40");
  const brands = useOptions(sysAdminAdd ? "/api/lookups/brands" : null);
  return [
    { name: "authorityLevelId", label: "Authority Level", type: "select", required: true, options: levels.options },
    { name: "value", label: "Authority Value", type: "text", required: true },
    ...(sysAdminAdd ? [{ name: "oaBrandId", label: "Brand", type: "select", options: brands.options } as DynamicField] : []),
  ];
}

const useAddFields = () => useAuthorityFields("add");
const useEditFields = () => useAuthorityFields("edit");

export default function AuthorityLevelFormPage({ mode, id }: { mode: "add" | "edit"; id?: string }) {
  return (
    <ResourceFormPage<AuthorityForm, AuthorityDto>
      title={mode === "add" ? "New Authority Level" : "Edit Authority Level"}
      breadcrumb={["User", "Authority Level"]}
      mode={mode}
      id={id}
      apiPath="/api/user/authoritylevel"
      basePath="/user/authoritylevel"
      useFields={mode === "add" ? useAddFields : useEditFields}
      defaultValues={{ authorityLevelId: "", value: "", oaBrandId: "" }}
      toForm={(dto) => ({
        authorityLevelId: dto.authorityLevelId ? String(dto.authorityLevelId) : "",
        value: dto.value ?? "",
        oaBrandId: dto.oaBrandId ? String(dto.oaBrandId) : "",
      })}
      toPayload={(v) => ({ ...v, oaBrandId: mode === "add" ? v.oaBrandId || undefined : undefined })}
    />
  );
}
