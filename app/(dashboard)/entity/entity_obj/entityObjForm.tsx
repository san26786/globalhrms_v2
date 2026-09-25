"use client";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";

/** CI entity/entity_obj initForm (viewEntity_obj_v): Object Type + Object Name. */
interface EntityObjForm {
  objTyp: string;
  objNm: string;
}

const fields: DynamicField[] = [
  {
    name: "objTyp",
    label: "Object Type",
    type: "select",
    required: true,
    options: [
      { value: "BASE TABLE", label: "BASE TABLE" },
      { value: "VIEW", label: "VIEW" },
    ],
  },
  { name: "objNm", label: "Object Name", type: "text", required: true, placeholder: "letters, numbers and _ only" },
];

export default function EntityObjFormPage({ mode, id }: { mode: "add" | "edit"; id?: string }) {
  return (
    <ResourceFormPage<EntityObjForm>
      title={mode === "add" ? "New Entity Object" : "Edit Entity Object"}
      breadcrumb={["Entity", "Entity Object"]}
      mode={mode}
      id={id}
      apiPath="/api/entity/entity_obj"
      basePath={mode === "edit" && id ? `/entity/entity_obj/${id}` : "/entity/entity_obj"}
      fields={fields}
      defaultValues={{ objTyp: "", objNm: "" }}
      toForm={(dto) => ({ objTyp: dto.objTyp, objNm: dto.objNm })}
    />
  );
}
