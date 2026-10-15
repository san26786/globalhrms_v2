"use client";

import { useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import { format, parseISO } from "date-fns";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import { authFetch } from "@/lib/auth/authFetch";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import type { SalaryComponentFormInit, SalaryComponentValues } from "@/lib/systmMngt/salaryComponentSettings";
import { useInit } from "../_shared/useInit";

/**
 * CI systmMngt/salary_component_settings initForm (formview_v + js/systmMngt/salary_component_settings.js):
 * the 16 component fields in CI order. Changing "Component Calc Type" (CI: focus-out) fills Component
 * Calc Type Config and Latest Calculated from the brand's percentage for the Payroll Comp Calc Type
 * (0 when the setting is missing, as CI).
 */
const API = "/api/systmMngt/salary_component_settings";

const EMPTY: SalaryComponentValues = {
  componentId: "",
  componentSequence: "",
  componentType: "",
  payGroupHead: "",
  payrollCompCalcType: "",
  componentCalcType: "",
  componentCalcTypeConfig: "",
  isAnnual: false,
  taxableStatus: "",
  otApplicable: false,
  otIncluded: false,
  effectiveFrom: "",
  latestCalculated: "",
  isEnabled: true,
  visibleInAnnexure: false,
  visibleInSalary: false,
};

const toPicker = (ymd: string) => (ymd ? parseISO(ymd).toISOString() : "");
const toYmd = (v: string) => (v ? format(new Date(v), "yyyy-MM-dd") : "");
const opts = (list: Array<{ value: number; label: string }>) => list.map((o) => ({ value: String(o.value), label: o.label }));

/** CI focusout on #componentCalcType → getCompTypeConfig (debounced change here). */
function useCalcConfig(form: UseFormReturn<SalaryComponentValues>) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const sub = form.watch((values, { name, type }) => {
      if (type !== "change" || (name !== "componentCalcType" && name !== "payrollCompCalcType")) return;
      const cct = (values.componentCalcType ?? "").trim();
      const pcct = values.payrollCompCalcType ?? "";
      if (!cct || !pcct) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        authFetch(`${API}/calc?cct=${encodeURIComponent(cct)}&pcct=${encodeURIComponent(pcct)}`)
          .then((res) => res.json())
          .then((json: { success?: boolean; data?: { success: boolean; result?: number } }) => {
            const value = json.success && json.data?.success ? String(json.data.result ?? 0) : "0";
            form.setValue("componentCalcTypeConfig", value, { shouldDirty: true });
            form.setValue("latestCalculated", value, { shouldDirty: true });
          })
          .catch(() => undefined);
      }, 500);
    });
    return () => {
      sub.unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [form]);
}

export default function SalaryComponentForm({ mode, id }: { mode: "add" | "edit"; id?: string }) {
  const { data, error } = useInit<SalaryComponentFormInit>(`${API}/init${id ? `?id=${encodeURIComponent(id)}` : ""}`);
  if (error) return <p className="p-6 text-sm text-red-500">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-gray-400">Loading…</p>;

  const o = data.options;
  const fields: DynamicField[] = [
    { name: "componentId", label: "Component", type: "select", required: true, options: opts(o.components) },
    { name: "componentSequence", label: "Component Sequence", type: "text", required: true },
    { name: "componentType", label: "Component Type", type: "select", required: true, options: opts(o.componentTypes) },
    { name: "payGroupHead", label: "Pay Group Head", type: "select", options: opts(o.payGroupHeads) },
    { name: "payrollCompCalcType", label: "Payroll Comp Calc Type", type: "select", options: opts(o.payrollCalcTypes) },
    { name: "componentCalcType", label: "Component Calc Type", type: "text" },
    { name: "componentCalcTypeConfig", label: "Component Calc Type Config", type: "text" },
    { name: "isAnnual", label: "Is Annual", type: "checkbox" },
    { name: "taxableStatus", label: "Taxable Status", type: "select", options: opts(o.taxableStatuses) },
    { name: "otApplicable", label: "Over Time Applicable", type: "checkbox" },
    { name: "otIncluded", label: "Over Time Included", type: "checkbox" },
    { name: "effectiveFrom", label: "Effective From", type: "date" },
    { name: "latestCalculated", label: "Latest Calculated", type: "text" },
    { name: "isEnabled", label: "Is Enabled", type: "checkbox" },
    { name: "visibleInAnnexure", label: "Visible In Annexure", type: "checkbox" },
    { name: "visibleInSalary", label: "Visible In Salary", type: "checkbox" },
  ];

  const initial = data.values ?? EMPTY;
  return (
    <ResourceFormPage<SalaryComponentValues>
      title={data.title}
      breadcrumb={["System Manager", "Salary Component"]}
      mode={mode}
      apiPath={API}
      // The record came with the init call: no reload, explicit PUT target in edit mode.
      submitUrl={id ? `${API}/${encodeURIComponent(id)}` : API}
      submitMethod={id ? "PUT" : "POST"}
      basePath="/systmMngt/salary_component_settings"
      fields={fields}
      defaultValues={{ ...initial, effectiveFrom: toPicker(initial.effectiveFrom) }}
      toPayload={(v) => ({ ...v, effectiveFrom: toYmd(v.effectiveFrom) })}
      useFormEffects={useCalcConfig}
    />
  );
}
