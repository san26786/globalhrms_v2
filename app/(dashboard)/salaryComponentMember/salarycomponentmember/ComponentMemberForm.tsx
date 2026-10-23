"use client";

import { useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import { authFetch } from "@/lib/auth/authFetch";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import { useOptions } from "@/lib/lookups/useOptions";
import type { SalaryComponentMemberDto } from "@/lib/salaryComponentMember/salaryComponentMember.resource";

/**
 * CI salaryComponentMember/salarycomponentmember initForm: Component, Member Component, Calculation
 * Sequence, Component Type, Is Enabled. Picking a member fills Component Type from the brand's
 * Salary Component settings for that component (still editable).
 */
const API = "/api/salaryComponentMember/salarycomponentmember";

interface ComponentMemberForm {
  componentId: string;
  typeId: string;
  calcSequence: string;
  componentTypeId: string;
  isEnabled: boolean;
}

const EMPTY: ComponentMemberForm = { componentId: "", typeId: "", calcSequence: "", componentTypeId: "", isEnabled: true };

function useFields(): DynamicField[] {
  const components = useOptions("/api/lookups/masters?typeCode=PSC");
  const componentTypes = useOptions("/api/lookups/masters?typeCode=CMPT");
  return [
    { name: "componentId", label: "Component", type: "select", required: true, options: components.options },
    { name: "typeId", label: "Member Component", type: "select", required: true, options: components.options },
    { name: "calcSequence", label: "Calculation Sequence", type: "number", required: true },
    { name: "componentTypeId", label: "Component Type", type: "select", required: true, options: componentTypes.options },
    { name: "isEnabled", label: "Is Enabled", type: "checkbox" },
  ];
}

function useMemberTypeDefault(form: UseFormReturn<ComponentMemberForm>) {
  const [componentTypeOf, setComponentTypeOf] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    authFetch(`${API}/component-types`)
      .then((res) => res.json())
      .then((json: { success?: boolean; data?: Record<string, string> }) => {
        if (!cancelled && json.success && json.data) setComponentTypeOf(json.data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    const sub = form.watch((values, { name, type }) => {
      if (type !== "change" || name !== "typeId") return;
      const componentType = componentTypeOf[values.typeId ?? ""];
      if (componentType) form.setValue("componentTypeId", componentType, { shouldDirty: true, shouldValidate: true });
    });
    return () => sub.unsubscribe();
  }, [form, componentTypeOf]);
}

const s = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

export default function ComponentMemberFormPage({ mode, id }: { mode: "add" | "edit"; id?: string }) {
  return (
    <ResourceFormPage<ComponentMemberForm, SalaryComponentMemberDto>
      title={mode === "add" ? "New Component Member" : "Edit Component Member"}
      breadcrumb={["Advance Settings", "Component Member"]}
      mode={mode}
      id={id}
      apiPath={API}
      basePath="/salaryComponentMember/salarycomponentmember"
      useFields={useFields}
      defaultValues={EMPTY}
      toForm={(dto) => ({
        componentId: s(dto.componentId),
        typeId: s(dto.typeId),
        calcSequence: s(dto.calcSequence),
        componentTypeId: s(dto.componentTypeId),
        isEnabled: dto.isEnabled,
      })}
      useFormEffects={useMemberTypeDefault}
    />
  );
}
