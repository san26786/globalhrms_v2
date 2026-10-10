"use client";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import { useOptions } from "@/lib/lookups/useOptions";
import { useUserAdminMeta } from "../_shared/formKit";

/** CI user_domain initForm: Domain Name, Description; Brand selector for the system admin (add). */
interface DomainForm {
  name: string;
  description: string;
  oaBrandId: string;
}

interface DomainDto {
  name: string;
  description: string | null;
  oaBrandId: number;
}

function useDomainFields(mode: "add" | "edit"): DynamicField[] {
  const meta = useUserAdminMeta();
  const sysAdminAdd = mode === "add" && meta?.adminLevel === 2;
  const brands = useOptions(sysAdminAdd ? "/api/lookups/brands" : null);
  return [
    { name: "name", label: "Domain Name", type: "text", required: true },
    { name: "description", label: "Description", type: "text" },
    ...(sysAdminAdd ? [{ name: "oaBrandId", label: "Brand", type: "select", options: brands.options } as DynamicField] : []),
  ];
}

const useAddFields = () => useDomainFields("add");
const useEditFields = () => useDomainFields("edit");

export default function DomainFormPage({ mode, id }: { mode: "add" | "edit"; id?: string }) {
  return (
    <ResourceFormPage<DomainForm, DomainDto>
      title={mode === "add" ? "New User Domain" : "Edit User Domain"}
      breadcrumb={["User", "User Domain"]}
      mode={mode}
      id={id}
      apiPath="/api/user/user_domain"
      basePath="/user/user_domain"
      useFields={mode === "add" ? useAddFields : useEditFields}
      defaultValues={{ name: "", description: "", oaBrandId: "" }}
      toForm={(dto) => ({ name: dto.name, description: dto.description ?? "", oaBrandId: String(dto.oaBrandId) })}
      toPayload={(v) => ({ name: v.name, description: v.description, oaBrandId: mode === "add" ? v.oaBrandId || undefined : undefined })}
    />
  );
}
