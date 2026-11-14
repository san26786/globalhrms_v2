"use client";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import type { QuarterFormModel, QuarterValues } from "@/lib/payroll/form16/quarters";
import { useInit } from "../../../systmMngt/_shared/useInit";
import { FORM16_LIST, QUARTERS_API, QUARTERS_BASE } from "../form16Client";

/**
 * CI form16/form16_quarters::initForm (formview_v): Quarters, Receipt No, Amount, Amount Tax, BSR Code, Tax Date,
 * Challan Sl No, Oltas Status, and the Form 16 it belongs to (CI: a hidden form16_id). Saving returns to the Form 16
 * it was opened from, else to the quarters list; "Save And Add" opens a new quarter for the same Form 16.
 * Rules: lib/payroll/form16/quarters.ts. Behaviour change: a quarter added from the list picks its Form 16 (CI saved
 * none); cancel returns to where the form was opened from (CI: always the quarters list).
 */
const EMPTY: QuarterValues = {
  FORM16_ID: "", QUARTERS_ID: "", RECEIPT_NO: "", AMOUNT: "", AMOUNT_TAX: "", BSR_CODE: "", TAX_DATE: "", CHALLAN_SL_NO: "", OLTAS_STATUS: "",
};
const opts = (list: Array<{ value: number | string; label: string }>) => list.map((o) => ({ value: String(o.value), label: o.label }));

export default function QuarterForm({ mode, id, form16, fromList }: { mode: "add" | "edit"; id?: string; form16?: string; fromList?: boolean }) {
  const formUrl = mode === "edit" ? `${QUARTERS_API}/form?id=${encodeURIComponent(id ?? "")}` : `${QUARTERS_API}/form${form16 ? `?form16=${encodeURIComponent(form16)}` : ""}`;
  const { data, error } = useInit<QuarterFormModel>(formUrl);
  if (error) return <p className="p-6 text-sm text-red-500">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-gray-400">Loading…</p>;

  const parent = data.form16;
  // Back to the Form 16 it came from (its "Add Items" / row edit), else the quarters list.
  const back = parent && !fromList ? `${FORM16_LIST}/edit/${parent.id}` : QUARTERS_BASE;
  const select = (name: keyof QuarterValues, label: string, list: Array<{ value: number | string; label: string }>, extra: Partial<DynamicField> = {}): DynamicField => ({
    name, label, type: "select", options: opts(list), required: true, ...extra,
  });
  const text = (name: keyof QuarterValues, label: string, type = "text"): DynamicField => ({ name, label, type, required: true });

  const fields: DynamicField[] = [
    parent
      ? select("FORM16_ID", "Form-16", [{ value: parent.id, label: parent.label }], { disabled: true })
      : select("FORM16_ID", "Form-16", data.options.form16s),
    select("QUARTERS_ID", "Quarters", data.options.quarters, { attribute: "QUARTERS_ID" }),
    text("RECEIPT_NO", "Receipt No"),
    text("AMOUNT", "Amount", "number"),
    text("AMOUNT_TAX", "Amount Tax", "number"),
    text("BSR_CODE", "BSR Code"),
    text("TAX_DATE", "Tax Date", "date-input"),
    text("CHALLAN_SL_NO", "Challan Sl No"),
    select("OLTAS_STATUS", "Oltas Status", data.options.oltas, { attribute: "OLTAS_STATUS" }),
  ];

  return (
    <ResourceFormPage<QuarterValues>
      title={mode === "add" ? "Add New Form-16 Quarter Details" : "Edit Form-16 Quarters"}
      breadcrumb={["Payroll", "Form-16 Quarters"]}
      mode={mode}
      id={id}
      apiPath={QUARTERS_API}
      basePath={back}
      objectName="form16_quarters_vw"
      fields={fields}
      defaultValues={{ ...EMPTY, FORM16_ID: parent ? String(parent.id) : "" }}
      allowSaveAndAdd
      saveAndAddOnEdit
      addHref={parent && !fromList ? `${QUARTERS_BASE}/add?form16=${parent.id}` : `${QUARTERS_BASE}/add`}
      canSubmit={data.canSave}
    >
      {data.missingMasters.length ? (
        <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          No {data.missingMasters.join(" or ")} are set up yet — add them under Master Data before saving a quarter.
        </div>
      ) : null}
    </ResourceFormPage>
  );
}
