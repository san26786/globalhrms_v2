"use client";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import {
  CONDITIONAL_MONTHLY,
  MONTHS,
  SECTION_FIELDS,
  ruleFieldsFor,
  type RuleFormModel,
  type RuleValues,
  type SectionField,
} from "@/lib/benefitrules/ruleTypes";
import { useInit } from "../../systmMngt/_shared/useInit";

/**
 * CI benefitrules/benefitrules initForm (formview_v): the fields of the rule type — Section (Investment
 * Declaration), Tax Allowance Type / Component / Dependent On Component (Benefit Rules), then
 * Calculation Factor, Month (only for "Conditional Monthly Value"), the section's own fields, limits
 * (Open Limit = no upper limit), flags, Values, Sign Factor, Gender, Comment, Financial Year, Country.
 * As CI benefitrules.js: the chosen section decides which of Payment / Age / Medical Expenses /
 * Dependent Disability / Disability Type / Self Occupied / In Same Council / Completion Status show.
 */
const API = "/api/benefitrules/benefitrules";
const BASE = "/benefitrules/benefitrules";

const EMPTY: RuleValues = {
  tax_allowance_type: "", component_id: "", section_id: "", calculation_factor: "", month: "", dependent_on_component: "",
  self_occupied: false, in_same_council: false, completion_status: "", payment: "", age_id: "", medical_expenses: "",
  dependent_disability: "", disability_type: "", lower_limit: "", open_limit: false, is_disable: false, new_regime: false,
  upper_limit: "", values: "", sign_factor: "", gender: "", comment: "", financial_year: "", country: "",
};

const opts = (list: Array<{ value: number | string; label: string }>) => list.map((o) => ({ value: String(o.value), label: o.label }));
const MONTH_OPTIONS = MONTHS.map((m, i) => ({ value: String(i + 1), label: m }));

export default function BenefitRuleForm({ mode, type, id }: { mode: "add" | "edit"; type?: string; id?: string }) {
  const formUrl = mode === "edit" ? `${API}/form?id=${encodeURIComponent(id ?? "")}` : `${API}/form?type=${encodeURIComponent(type ?? "")}`;
  const { data, error } = useInit<RuleFormModel>(formUrl);
  if (error) return <p className="p-6 text-sm text-red-500">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-gray-400">Loading…</p>;

  const { options: o } = data;
  const uses = ruleFieldsFor(data.code);

  const useFields = (v: RuleValues): DynamicField[] => {
    const sectionCode = o.sections.find((s) => String(s.value) === v.section_id)?.code ?? "";
    const sectionUses = new Set<SectionField>(uses.section ? (SECTION_FIELDS[sectionCode] ?? []) : []);
    const conditional = o.calculationFactors.find((c) => String(c.value) === v.calculation_factor)?.code === CONDITIONAL_MONTHLY;
    const select = (name: keyof RuleValues, label: string, list: Array<{ value: number | string; label: string }>, extra: Partial<DynamicField> = {}): DynamicField => ({
      name, label, type: "select", options: opts(list), ...extra,
    });
    const inSection = (field: SectionField) => !sectionUses.has(field);
    return [
      select("section_id", "Section", o.sections, { required: true, hidden: !uses.section }),
      select("tax_allowance_type", "Tax Allowance Type", o.taxAllowanceTypes, { hidden: !uses.component }),
      select("component_id", "Component", o.components, { required: true, hidden: !uses.component }),
      select("calculation_factor", "Calculation Factor", o.calculationFactors, { required: true }),
      { name: "month", label: "Month", type: "select", options: MONTH_OPTIONS, required: true, hidden: !conditional },
      select("dependent_on_component", "Dependent On Component", o.components, { hidden: !uses.component }),
      { name: "self_occupied", label: "Self Occupied", type: "checkbox", hidden: inSection("self_occupied") },
      { name: "in_same_council", label: "In Same Council", type: "checkbox", hidden: inSection("in_same_council") },
      select("completion_status", "Completion Status", o.completionStatuses, { hidden: inSection("completion_status") }),
      select("payment", "Payment", o.payments, { hidden: inSection("payment") }),
      select("age_id", "Age", o.ages, { hidden: inSection("age_id") }),
      select("medical_expenses", "Medical Expenses", o.medicalExpenses, { hidden: inSection("medical_expenses") }),
      select("dependent_disability", "Dependent Disability", o.dependentDisabilities, { hidden: inSection("dependent_disability") }),
      select("disability_type", "Disability Type", o.disabilityTypes, { hidden: inSection("disability_type") }),
      { name: "lower_limit", label: "Lower Limit", type: "number", required: uses.limitsRequired },
      { name: "open_limit", label: "Open Limit", type: "checkbox" },
      { name: "is_disable", label: "Is Disability Rule Applied", type: "checkbox" },
      { name: "new_regime", label: "Is New Regime", type: "checkbox" },
      {
        name: "upper_limit",
        label: "Upper Limit",
        type: v.open_limit ? "text" : "number",
        required: uses.limitsRequired && !v.open_limit,
        disabled: v.open_limit,
        placeholder: v.open_limit ? "∞ (no upper limit)" : undefined,
      },
      { name: "values", label: "Values", type: "text", required: true },
      select("sign_factor", "Sign Factor", o.signFactors),
      select("gender", "Gender", o.genders),
      { name: "comment", label: "Comment", type: "textarea" },
      select("financial_year", "Financial Year", o.financialYears),
      select("country", "Country", o.countries),
    ];
  };

  const listPath = `${BASE}?type=${data.code}`;
  return (
    <ResourceFormPage<RuleValues, RuleValues & { code: string }>
      title={`${mode === "add" ? "New" : "Edit"} ${data.title}`}
      breadcrumb={["Advance Settings", data.title]}
      mode={mode}
      id={id}
      apiPath={API}
      basePath={listPath}
      allowSaveAndAdd={false}
      useFields={useFields}
      defaultValues={EMPTY}
      toForm={({ code: _code, ...values }) => {
        void _code;
        return values;
      }}
      toPayload={(values) => ({ ...values, upper_limit: values.open_limit ? "" : values.upper_limit, type: data.code })}
    />
  );
}
