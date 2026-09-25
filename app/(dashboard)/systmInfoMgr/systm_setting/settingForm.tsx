"use client";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import { useOptions } from "@/lib/lookups/useOptions";

/**
 * CI systm_setting initForm. Reference Type → Reference is a dependent dropdown
 * (CI ajaxDepnDropRefId); the reference code is derived by the server (CI ajaxDepnDropRefCod).
 * CI's org/brand selectors (sysadmin only) are the "Brand" field.
 */
interface SettingForm {
  refTypeId: string;
  refId: string;
  attributeId: string;
  attributeValueId: string;
  settingValue: string;
  description: string;
  isEnabled: boolean;
  isCurrent: boolean;
  oaBrandId: string;
}

interface SettingDto {
  refTypeId: number | null;
  refId: number | null;
  attributeId: number;
  attributeValueId: number | null;
  settingValue: string;
  description: string | null;
  isEnabled: boolean;
  isCurrent: boolean;
  oaBrandId: number;
}

function useSettingFields(values: SettingForm, mode: "add" | "edit"): DynamicField[] {
  const refTypes = useOptions("/api/lookups/common-types?parentTypeId=74");
  const refs = useOptions(values.refTypeId ? `/api/lookups/masters?typeId=${values.refTypeId}` : null);
  const attributes = useOptions("/api/lookups/masters?typeId=3");
  const brands = useOptions(mode === "add" ? "/api/lookups/brands" : null);

  return [
    { name: "refTypeId", label: "Reference Type", type: "select", required: true, options: refTypes.options },
    { name: "refId", label: "Reference", type: "select", required: true, options: refs.options },
    { name: "attributeId", label: "System Attribute", type: "select", required: true, options: attributes.options },
    { name: "attributeValueId", label: "Attribute Value Id", type: "number" },
    { name: "settingValue", label: "Setting Value", type: "text" },
    { name: "description", label: "Description", type: "text" },
    { name: "isEnabled", label: "Is Enabled", type: "checkbox" },
    { name: "isCurrent", label: "Is Current", type: "checkbox" },
    // Only a sysadmin receives more than their own brand; the server ignores this for everyone else.
    ...(mode === "add" && brands.options.length > 1
      ? [{ name: "oaBrandId", label: "Brand", type: "select", options: brands.options } as DynamicField]
      : []),
  ];
}

const useAddSettingFields = (v: SettingForm) => useSettingFields(v, "add");
const useEditSettingFields = (v: SettingForm) => useSettingFields(v, "edit");

export default function SettingFormPage({ mode, id }: { mode: "add" | "edit"; id?: string }) {
  return (
    <ResourceFormPage<SettingForm, SettingDto>
      title={mode === "add" ? "Add System Setting" : "Edit System Setting"}
      breadcrumb={["System Information", "System Setting"]}
      mode={mode}
      id={id}
      apiPath="/api/systmInfoMgr/systm_setting"
      basePath="/systmInfoMgr/systm_setting"
      useFields={mode === "add" ? useAddSettingFields : useEditSettingFields}
      defaultValues={{
        refTypeId: "",
        refId: "",
        attributeId: "",
        attributeValueId: "",
        settingValue: "",
        description: "",
        isEnabled: true,
        isCurrent: false,
        oaBrandId: "",
      }}
      toForm={(dto) => ({
        refTypeId: dto.refTypeId ? String(dto.refTypeId) : "",
        refId: dto.refId ? String(dto.refId) : "",
        attributeId: String(dto.attributeId),
        attributeValueId: dto.attributeValueId !== null ? String(dto.attributeValueId) : "",
        settingValue: dto.settingValue ?? "",
        description: dto.description ?? "",
        isEnabled: dto.isEnabled,
        isCurrent: dto.isCurrent,
        oaBrandId: String(dto.oaBrandId),
      })}
      toPayload={(v) => ({ ...v, oaBrandId: v.oaBrandId || undefined })}
    />
  );
}
