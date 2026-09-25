"use client";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import { useOptions } from "@/lib/lookups/useOptions";

/** CI obj_mppng initForm: source layer/object, target layer/object (layers = common_type children of 27). */
interface ObjMappingForm {
  srcLyrId: string;
  srcObjId: string;
  trgtLyrId: string;
  trgtObjId: string;
}

interface ObjMappingDto {
  srcLyrId: number;
  srcObjId: number;
  trgtLyrId: number;
  trgtObjId: number;
}

function useObjMappingFields(): DynamicField[] {
  const layers = useOptions("/api/lookups/common-types?parentTypeId=27");
  const objects = useOptions("/api/entity/lookups/objects");
  return [
    { name: "srcLyrId", label: "Source Layer", type: "select", required: true, options: layers.options },
    { name: "srcObjId", label: "Source Object", type: "select", required: true, options: objects.options },
    { name: "trgtLyrId", label: "Target Layer", type: "select", required: true, options: layers.options },
    { name: "trgtObjId", label: "Target Object", type: "select", required: true, options: objects.options },
  ];
}

export default function ObjMappingFormPage({ mode, id }: { mode: "add" | "edit"; id?: string }) {
  return (
    <ResourceFormPage<ObjMappingForm, ObjMappingDto>
      title={mode === "add" ? "New Object Mapping" : "Edit Object Mapping"}
      breadcrumb={["Entity", "Object Mapping"]}
      mode={mode}
      id={id}
      apiPath="/api/entity/obj_mppng"
      basePath="/entity/obj_mppng"
      useFields={useObjMappingFields}
      defaultValues={{ srcLyrId: "", srcObjId: "", trgtLyrId: "", trgtObjId: "" }}
      toForm={(dto) => ({
        srcLyrId: String(dto.srcLyrId),
        srcObjId: String(dto.srcObjId),
        trgtLyrId: String(dto.trgtLyrId),
        trgtObjId: String(dto.trgtObjId),
      })}
    />
  );
}
