"use client";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import { useOptions } from "@/lib/lookups/useOptions";

/**
 * CI entity_obj_attrbt_mppng initForm: object mapping → source attribute (of the mapping's source
 * object) and target attribute (of the mapping's TARGET object — CI listed every attribute).
 */
interface AttributeMappingForm {
  objMppngId: string;
  srcAttributeId: string;
  trgAttributeId: string;
}

interface AttributeMappingDto {
  objMppngId: number;
  srcAttributeId: number | null;
  trgAttributeId: number | null;
}

function useAttributeMappingFields(values: AttributeMappingForm): DynamicField[] {
  const mappings = useOptions("/api/entity/lookups/object-mappings");
  const attrs = (side: "src" | "trg") =>
    values.objMppngId ? `/api/entity/lookups/mapping-attributes?mappingId=${encodeURIComponent(values.objMppngId)}&side=${side}` : null;
  const src = useOptions(attrs("src"));
  const trg = useOptions(attrs("trg"));
  return [
    { name: "objMppngId", label: "Object Mapping", type: "select", required: true, options: mappings.options },
    { name: "srcAttributeId", label: "Source Attribute", type: "select", required: true, options: src.options },
    { name: "trgAttributeId", label: "Target Attribute", type: "select", required: true, options: trg.options },
  ];
}

export default function AttributeMappingFormPage({ mode, id }: { mode: "add" | "edit"; id?: string }) {
  return (
    <ResourceFormPage<AttributeMappingForm, AttributeMappingDto>
      title={mode === "add" ? "New Entity Object Attribute Mapping" : "Edit Entity Object Attribute Mapping"}
      breadcrumb={["Entity", "Entity Object Attribute Mapping"]}
      mode={mode}
      id={id}
      apiPath="/api/entity/entity_obj_attrbt_mppng"
      basePath="/entity/entity_obj_attrbt_mppng"
      useFields={useAttributeMappingFields}
      defaultValues={{ objMppngId: "", srcAttributeId: "", trgAttributeId: "" }}
      toForm={(dto) => ({
        objMppngId: String(dto.objMppngId),
        srcAttributeId: dto.srcAttributeId !== null ? String(dto.srcAttributeId) : "",
        trgAttributeId: dto.trgAttributeId !== null ? String(dto.trgAttributeId) : "",
      })}
    />
  );
}
