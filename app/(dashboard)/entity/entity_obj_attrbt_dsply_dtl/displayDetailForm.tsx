"use client";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import { useOptions } from "@/lib/lookups/useOptions";

/**
 * CI entity_obj_attrbt_dsply_dtl initForm (viewEntity_obj_attrbt_dsply_dtl_v): object →
 * dependent attribute (CI DepnDropObjNm), display name; the sysadmin may pick the brand
 * (CI OrgDetailsView). The attribute name is taken from the chosen attribute by the server.
 */
interface DisplayDetailForm {
  objNm: string;
  objAttrbtId: string;
  objAttrbtDsplyNm: string;
  isVisibleForListview: boolean;
  isVisibleForFormview: boolean;
  oaBrandId: string;
}

interface DisplayDetailDto {
  objNm: string;
  objAttrbtId: number;
  objAttrbtDsplyNm: string;
  isVisibleForListview: boolean;
  isVisibleForFormview: boolean;
  oaBrandId: number | null;
}

function useDisplayDetailFields(values: DisplayDetailForm, mode: "add" | "edit"): DynamicField[] {
  const objects = useOptions("/api/entity/lookups/attribute-objects");
  const attributes = useOptions(values.objNm ? `/api/entity/lookups/attributes?objNm=${encodeURIComponent(values.objNm)}` : null);
  const brands = useOptions(mode === "add" ? "/api/lookups/brands" : null);

  return [
    { name: "objNm", label: "Object Name", type: "select", required: true, options: objects.options },
    { name: "objAttrbtId", label: "Attribute Name", type: "select", required: true, options: attributes.options },
    { name: "objAttrbtDsplyNm", label: "Display Name", type: "text", required: true },
    { name: "isVisibleForListview", label: "Visible in List View", type: "checkbox" },
    { name: "isVisibleForFormview", label: "Visible in Form View", type: "checkbox" },
    // Only a sysadmin receives more than their own brand; the server ignores this for everyone else.
    ...(mode === "add" && brands.options.length > 1
      ? [{ name: "oaBrandId", label: "Brand", type: "select", options: brands.options } as DynamicField]
      : []),
  ];
}

const useAddFields = (v: DisplayDetailForm) => useDisplayDetailFields(v, "add");
const useEditFields = (v: DisplayDetailForm) => useDisplayDetailFields(v, "edit");

export default function DisplayDetailFormPage({ mode, id }: { mode: "add" | "edit"; id?: string }) {
  return (
    <ResourceFormPage<DisplayDetailForm, DisplayDetailDto>
      title={mode === "add" ? "New Entity Object Attribute Display" : "Edit Entity Object Attribute Display"}
      breadcrumb={["Entity", "Entity Object Attribute Display"]}
      mode={mode}
      id={id}
      apiPath="/api/entity/entity_obj_attrbt_dsply_dtl"
      basePath="/entity/entity_obj_attrbt_dsply_dtl"
      useFields={mode === "add" ? useAddFields : useEditFields}
      defaultValues={{
        objNm: "",
        objAttrbtId: "",
        objAttrbtDsplyNm: "",
        isVisibleForListview: true,
        isVisibleForFormview: true,
        oaBrandId: "",
      }}
      toForm={(dto) => ({
        objNm: dto.objNm,
        objAttrbtId: String(dto.objAttrbtId),
        objAttrbtDsplyNm: dto.objAttrbtDsplyNm,
        isVisibleForListview: dto.isVisibleForListview,
        isVisibleForFormview: dto.isVisibleForFormview,
        oaBrandId: dto.oaBrandId !== null ? String(dto.oaBrandId) : "",
      })}
      toPayload={(v) => ({ ...v, oaBrandId: v.oaBrandId || undefined })}
    />
  );
}
