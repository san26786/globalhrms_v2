"use client";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import { useOptions } from "@/lib/lookups/useOptions";

/**
 * CI common/common_type initForm — System Entity add / edit: Type Id (key, read-only on edit),
 * Type Code, Type Name, View Name, Data Type (existing TABLE_TYPE values), Visible To User,
 * User Can Create Data, Is Editable, Set Parent Type → Parent Type.
 */
interface EntityForm {
  typeId: string;
  code: string;
  name: string;
  viewName: string;
  dataType: string;
  visibleToUser: boolean;
  userCanCreateData: boolean;
  isEditable: boolean;
  hasParent: boolean;
  parentTypeId: string;
}

interface EntityDto {
  typeId: number;
  code: string;
  name: string;
  viewName: string | null;
  dataType: string | null;
  visibleToUser: boolean;
  userCanCreateData: boolean;
  isEditable: boolean;
  parentTypeId: number | null;
}

function useEntityFields(values: EntityForm, mode: "add" | "edit"): DynamicField[] {
  const dataTypes = useOptions("/api/common/common_type/options?kind=data-types");
  const parentTypes = useOptions("/api/common/common_type/options?kind=parent-types");

  return [
    { name: "typeId", label: "Type Id", type: "number", required: true, readOnly: mode === "edit" },
    { name: "code", label: "Type Code", type: "text", required: true },
    { name: "name", label: "Type Name", type: "text", required: true },
    { name: "viewName", label: "View Name", type: "text", required: true },
    { name: "dataType", label: "Data Type", type: "select", options: dataTypes.options },
    { name: "visibleToUser", label: "Visible To User", type: "checkbox" },
    { name: "userCanCreateData", label: "User Can Create Data", type: "checkbox" },
    { name: "isEditable", label: "Is Editable", type: "checkbox" },
    { name: "hasParent", label: "Set Parent Type", type: "checkbox" },
    { name: "parentTypeId", label: "Parent Type", type: "select", options: parentTypes.options, hidden: !values.hasParent },
  ];
}

const useAddEntityFields = (v: EntityForm) => useEntityFields(v, "add");
const useEditEntityFields = (v: EntityForm) => useEntityFields(v, "edit");

export default function EntityFormPage({ mode, id }: { mode: "add" | "edit"; id?: string }) {
  return (
    <ResourceFormPage<EntityForm, EntityDto>
      title={mode === "add" ? "Add System Entity" : "Edit System Entity"}
      breadcrumb={["Master Data Manager", "System Entities"]}
      mode={mode}
      id={id}
      apiPath="/api/common/common_type"
      basePath="/common/common_type"
      useFields={mode === "add" ? useAddEntityFields : useEditEntityFields}
      defaultValues={{
        typeId: "",
        code: "",
        name: "",
        viewName: "",
        dataType: "",
        visibleToUser: false,
        userCanCreateData: false,
        isEditable: false,
        hasParent: false,
        parentTypeId: "",
      }}
      toForm={(dto) => ({
        typeId: String(dto.typeId),
        code: dto.code ?? "",
        name: dto.name ?? "",
        viewName: dto.viewName ?? "",
        dataType: dto.dataType ?? "",
        visibleToUser: dto.visibleToUser,
        userCanCreateData: dto.userCanCreateData,
        isEditable: dto.isEditable,
        hasParent: !!dto.parentTypeId,
        parentTypeId: dto.parentTypeId ? String(dto.parentTypeId) : "",
      })}
      toPayload={(v) => ({ ...v, parentTypeId: v.hasParent ? v.parentTypeId || null : null })}
    />
  );
}
