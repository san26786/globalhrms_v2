"use client";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import type { QuarterSettingFormModel, QuarterSettingValues } from "@/lib/payroll/form16/quarterSettings";
import { useInit } from "../../../systmMngt/_shared/useInit";

/**
 * CI form16/form16_quarter_settings::initForm (formview_v): Financial Year, Quarter, Start Date, End Date (labels of
 * the view's Form Settings). Rules: lib/payroll/form16/quarterSettings.ts.
 */
const API = "/api/form16/form16_quarter_settings";
const BASE = "/form16/form16/quarter_settings";
const EMPTY: QuarterSettingValues = { FINANCIAL_YEAR_ID: "", QUARTER_ID: "", START_DATE: "", END_DATE: "" };
const opts = (list: Array<{ value: number; label: string }>) => list.map((o) => ({ value: String(o.value), label: o.label }));

export default function QuarterSettingForm({ mode, id }: { mode: "add" | "edit"; id?: string }) {
  const { data, error } = useInit<QuarterSettingFormModel>(id ? `${API}/form?id=${encodeURIComponent(id)}` : `${API}/form`);
  if (error) return <p className="p-6 text-sm text-red-500">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-gray-400">Loading…</p>;

  const fields: DynamicField[] = [
    { name: "FINANCIAL_YEAR_ID", label: "Financial Year", type: "select", options: opts(data.options.financialYears), required: true, attribute: "FINANCIAL_YEAR_ID" },
    { name: "QUARTER_ID", label: "Quarter", type: "select", options: opts(data.options.quarters), required: true, attribute: "QUARTER_ID" },
    { name: "START_DATE", label: "Start Date", type: "date-input", required: true, attribute: "START_DATE" },
    { name: "END_DATE", label: "End Date", type: "date-input", required: true, attribute: "END_DATE" },
  ];

  return (
    <ResourceFormPage<QuarterSettingValues>
      title={mode === "add" ? "Add New Form-16 Quarter Setting Details" : "Edit Form-16 Quarter Settings Details"}
      breadcrumb={["Payroll", "Form-16 Quarter Settings Detail"]}
      mode={mode}
      id={id}
      apiPath={API}
      basePath={BASE}
      objectName="form16_quarter_settings_vw"
      fields={fields}
      defaultValues={EMPTY}
      allowSaveAndAdd
      saveAndAddOnEdit
      canSubmit={data.canSave}
    >
      {data.missingMasters.length ? (
        <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          No {data.missingMasters.join(" or ")} are set up yet — add them under Master Data before saving a quarter setting.
        </div>
      ) : null}
    </ResourceFormPage>
  );
}
