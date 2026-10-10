"use client";

import { useEffect, useState } from "react";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import { authFetch } from "@/lib/auth/authFetch";
import { useOptions } from "@/lib/lookups/useOptions";

/**
 * CI entity/entity_obj_attrbt initForm. The parent object (OBJ_NM) is fixed when the form is opened
 * from an entity's Attributes tab; otherwise it is chosen from the entity objects. It cannot change on edit.
 */
interface AttributeForm {
  objId: string;
  objNm: string;
  objTyp: string;
  objAttrbtNm: string;
  objAttrbtDtTyp: string;
  objAttrbtSeq: string;
  isNull: string;
  objSz: string;
  objPrcsn: string;
  objScale: string;
  isVisible: boolean;
}

interface AttributeDto {
  objId: number | null;
  objNm: string;
  objTyp: string;
  objAttrbtNm: string;
  objAttrbtDtTyp: string;
  objAttrbtSeq: number;
  isNull: string;
  objSz: number | null;
  objPrcsn: number | null;
  objScale: number | null;
  isVisible: boolean;
}

interface ParentObject {
  id: number;
  objNm: string;
  objTyp: string;
}

const OBJECT_TYPES = [
  { value: "BASE TABLE", label: "BASE TABLE" },
  { value: "VIEW", label: "VIEW" },
];
const YES_NO = [
  { value: "YES", label: "YES" },
  { value: "NO", label: "NO" },
];

function attributeFields(objectField: DynamicField): DynamicField[] {
  return [
    objectField,
    { name: "objTyp", label: "Object Type", type: "select", required: true, options: OBJECT_TYPES },
    { name: "objAttrbtNm", label: "Object Attribute Name", type: "text", required: true },
    { name: "objAttrbtDtTyp", label: "Object Attribute Data Type", type: "text", required: true },
    { name: "objAttrbtSeq", label: "Object Attribute Sequence", type: "number", required: true },
    { name: "isNull", label: "Is Null", type: "select", options: YES_NO },
    { name: "objSz", label: "Size", type: "number" },
    { name: "objPrcsn", label: "Precision", type: "number" },
    { name: "objScale", label: "Scale", type: "number" },
    { name: "isVisible", label: "Is Visible", type: "checkbox" },
  ];
}

/** Object chooser (stand-alone add). */
function useChooseObjectFields(): DynamicField[] {
  const objects = useOptions("/api/entity/lookups/objects");
  return attributeFields({ name: "objId", label: "Object", type: "select", required: true, options: objects.options });
}

/** Fixed object (edit, or add from the entity's Attributes tab). */
function useFixedObjectFields(): DynamicField[] {
  return attributeFields({ name: "objNm", label: "Object Name", type: "text", readOnly: true });
}

const toForm = (dto: AttributeDto): AttributeForm => ({
  objId: dto.objId ? String(dto.objId) : "",
  objNm: dto.objNm,
  objTyp: dto.objTyp,
  objAttrbtNm: dto.objAttrbtNm,
  objAttrbtDtTyp: dto.objAttrbtDtTyp,
  objAttrbtSeq: String(dto.objAttrbtSeq),
  isNull: dto.isNull || "YES",
  objSz: dto.objSz !== null ? String(dto.objSz) : "",
  objPrcsn: dto.objPrcsn !== null ? String(dto.objPrcsn) : "",
  objScale: dto.objScale !== null ? String(dto.objScale) : "",
  isVisible: dto.isVisible,
});

/** The object name is display-only; the API takes the object id (create) or keeps it (edit). */
const toPayload = (values: AttributeForm) => {
  const { objNm, ...rest } = values;
  void objNm;
  return rest;
};

const EMPTY: AttributeForm = {
  objId: "",
  objNm: "",
  objTyp: "",
  objAttrbtNm: "",
  objAttrbtDtTyp: "",
  objAttrbtSeq: "",
  isNull: "YES",
  objSz: "",
  objPrcsn: "",
  objScale: "",
  isVisible: true,
};

interface Props {
  mode: "add" | "edit";
  id?: string;
  /** Parent entity_obj id when opened from the entity details page. */
  parentObjId?: string;
  /** Where to return after save/cancel. */
  returnPath: string;
}

export default function AttributeFormPage({ mode, id, parentObjId, returnPath }: Props) {
  const [parent, setParent] = useState<ParentObject | null>(null);
  const [parentError, setParentError] = useState<string | null>(null);
  const needsParent = mode === "add" && !!parentObjId;

  useEffect(() => {
    if (!needsParent || !parentObjId) return;
    let cancelled = false;
    authFetch(`/api/entity/entity_obj/${encodeURIComponent(parentObjId)}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.success) throw new Error(json.message ?? "Entity object not found.");
        setParent(json.data as ParentObject);
      })
      .catch((e) => {
        if (!cancelled) setParentError(e instanceof Error ? e.message : "Entity object not found.");
      });
    return () => {
      cancelled = true;
    };
  }, [needsParent, parentObjId]);

  if (needsParent && parentError) return <p className="p-6 text-sm text-red-500">{parentError}</p>;
  if (needsParent && !parent) return <p className="p-6 text-sm text-gray-400">Loading...</p>;

  const fixed = mode === "edit" || parent !== null;
  return (
    <ResourceFormPage<AttributeForm, AttributeDto>
      title={mode === "add" ? "New Entity Object Attribute" : "Edit Entity Object Attribute"}
      breadcrumb={["Entity", parent ? parent.objNm : "Entity Object Attribute"]}
      mode={mode}
      id={id}
      apiPath="/api/entity/entity_obj_attrbt"
      basePath={returnPath}
      useFields={fixed ? useFixedObjectFields : useChooseObjectFields}
      defaultValues={parent ? { ...EMPTY, objId: String(parent.id), objNm: parent.objNm, objTyp: parent.objTyp } : EMPTY}
      toForm={toForm}
      toPayload={toPayload}
    />
  );
}
