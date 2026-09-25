"use client";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import { useOptions } from "@/lib/lookups/useOptions";
import HelpNote from "../_components/HelpNote";
import { PRIVILEGES_NOTE } from "./privilegeList";

/**
 * CI obj_attrbt_previleges initForm: object → attribute of that object (CI listed every
 * attribute), brand (required, not 0; the organisation is derived from it).
 */
interface PrivilegeForm {
  objId: string;
  objAttrbtId: string;
  oaBrandId: string;
}

interface PrivilegeDto {
  objId: number;
  objAttrbtId: number | null;
  oaBrandId: number | null;
}

function usePrivilegeFields(values: PrivilegeForm): DynamicField[] {
  const objects = useOptions("/api/entity/lookups/objects");
  const attributes = useOptions(values.objId ? `/api/entity/lookups/attributes?objId=${encodeURIComponent(values.objId)}` : null);
  const brands = useOptions("/api/lookups/brands");
  return [
    { name: "objId", label: "Object", type: "select", required: true, options: objects.options },
    { name: "objAttrbtId", label: "Object Attribute", type: "select", required: true, options: attributes.options },
    { name: "oaBrandId", label: "Brand", type: "select", required: true, options: brands.options },
  ];
}

export default function PrivilegeFormPage({ mode, id }: { mode: "add" | "edit"; id?: string }) {
  return (
    <div>
      <div className="mx-auto max-w-5xl px-4 pt-4">
        <HelpNote>{PRIVILEGES_NOTE}</HelpNote>
      </div>
      <ResourceFormPage<PrivilegeForm, PrivilegeDto>
        title={mode === "add" ? "New Object Attribute Privileges" : "Edit Object Attribute Privileges"}
        breadcrumb={["Entity", "Object Attribute Privileges"]}
        mode={mode}
        id={id}
        apiPath="/api/entity/obj_attrbt_previleges"
        basePath="/entity/obj_attrbt_previleges"
        useFields={usePrivilegeFields}
        defaultValues={{ objId: "", objAttrbtId: "", oaBrandId: "" }}
        toForm={(dto) => ({
          objId: String(dto.objId),
          objAttrbtId: dto.objAttrbtId !== null ? String(dto.objAttrbtId) : "",
          oaBrandId: dto.oaBrandId !== null ? String(dto.oaBrandId) : "",
        })}
      />
    </div>
  );
}
