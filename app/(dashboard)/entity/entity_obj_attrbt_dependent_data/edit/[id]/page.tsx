"use client";

import { use } from "react";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import { FIELD_TYPES } from "@/validations/entity.schema";

/**
 * CI entity_obj_attrbt_dependent_data initForm (edit only): object / attribute read-only;
 * sequence, type code, field type (fixed list replacing the MySQL enum) and visibility editable.
 */
interface DependentDataForm {
  objNm: string;
  objAttrbtNm: string;
  objAttrbtSeq: string;
  objTypeCode: string;
  objFieldType: string;
  isVisible: boolean;
}

interface DependentDataDto {
  objNm: string;
  objAttrbtNm: string;
  objAttrbtSeq: number;
  objTypeCode: string | null;
  objFieldType: string;
  isVisible: boolean;
}

const FIELD_TYPE_OPTIONS = FIELD_TYPES.map((t) => ({ value: t, label: t }));

const fields: DynamicField[] = [
  { name: "objNm", label: "Object Name", type: "text", readOnly: true },
  { name: "objAttrbtNm", label: "Object Attribute Name", type: "text", readOnly: true },
  { name: "objAttrbtSeq", label: "Object Attribute Sequence", type: "number", required: true },
  { name: "objTypeCode", label: "Object Type Code", type: "text" },
  { name: "objFieldType", label: "Object Field Type", type: "select", required: true, options: FIELD_TYPE_OPTIONS },
  { name: "isVisible", label: "Is Visible", type: "checkbox" },
];

export default function EditDependentDataPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ResourceFormPage<DependentDataForm, DependentDataDto>
      title="Edit Entity Object Attribute Dependent Data"
      breadcrumb={["Entity", "Entity Object Attribute Dependent Data"]}
      mode="edit"
      id={id}
      apiPath="/api/entity/entity_obj_attrbt_dependent_data"
      basePath="/entity/entity_obj_attrbt_dependent_data"
      fields={fields}
      defaultValues={{ objNm: "", objAttrbtNm: "", objAttrbtSeq: "", objTypeCode: "", objFieldType: "", isVisible: true }}
      toForm={(dto) => ({
        objNm: dto.objNm,
        objAttrbtNm: dto.objAttrbtNm,
        objAttrbtSeq: String(dto.objAttrbtSeq),
        objTypeCode: dto.objTypeCode ?? "",
        objFieldType: dto.objFieldType,
        isVisible: dto.isVisible,
      })}
      toPayload={(v) => ({ objAttrbtSeq: v.objAttrbtSeq, objTypeCode: v.objTypeCode, objFieldType: v.objFieldType, isVisible: v.isVisible })}
    />
  );
}
