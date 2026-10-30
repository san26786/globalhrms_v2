"use client";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import { VAT_STATUS, vatFieldsFor, type VatRegistrationModel, type VatValues } from "@/lib/vatRegistrationSettings/vatRules";
import { useInit } from "../../systmMngt/_shared/useInit";

/**
 * CI vat_registration_settings/vat_registration_settings ("VAT Registration Settings", formview_v):
 * the brand's VAT status and, depending on it, registration number, dates, return frequency,
 * accounting basis, flat rate scheme and pre-registration expenses (CI vat_registration_settings.js
 * shows / hides them). Rules: lib/vatRegistrationSettings.
 */
const API = "/api/vat_registration_settings/vat_registration_settings";

const opts = (list: Array<{ value: number | string; label: string }>) => list.map((o) => ({ value: String(o.value), label: o.label }));

export default function VatRegistrationSettingsPage() {
  const { data, error, reload } = useInit<VatRegistrationModel>(API);
  if (error) return <p className="p-6 text-sm text-red-500">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-gray-400">Loading…</p>;

  const disabled = !data.canSave;
  const useFields = (values: VatValues): DynamicField[] => {
    // CI form script: with no status chosen yet the registered fields are shown.
    const apply = vatFieldsFor(values.vat_registered || VAT_STATUS.registered);
    const registered = apply.registration;
    return [
      { name: "vat_registered", label: "VAT Registered", type: "select", required: true, options: opts(data.options.statuses), disabled },
      { name: "registration_no", label: "VAT Registration No", type: "text", required: true, hidden: !registered, disabled },
      { name: "trade_in_eu", label: "Trade in EU", type: "checkbox", hidden: !registered, disabled },
      { name: "register_effective_date", label: "Effective Date of VAT Registration", type: "date", required: true, hidden: !apply.effectiveDate, disabled },
      { name: "first_vat_return", label: "First Vat Return Period End Date", type: "date", required: true, hidden: !registered, disabled },
      { name: "deregister_effective_date", label: "Deregisteration Effective Date", type: "date", required: true, hidden: !apply.deregisterDate, disabled },
      { name: "return_frequency", label: "Default VAT Return Frequency", type: "select", required: true, options: opts(data.options.returnFrequencies), hidden: !registered, disabled },
      { name: "accounting_basis", label: "Accounting Basis", type: "select", required: true, options: opts(data.options.accountingBases), hidden: !registered, disabled },
      { name: "is_flat_rate", label: "Flat Rate", type: "checkbox", hidden: !registered, disabled },
      { name: "flat_rate_scheme", label: "Flat Rate Scheme", type: "select", required: true, options: opts(data.options.flatRateSchemes), hidden: !registered || !values.is_flat_rate, disabled },
      { name: "inc_pre_reg_expeneses", label: "Include Pre Registration Expenses", type: "select", required: true, options: opts(data.options.preRegExpenses), hidden: !registered, disabled },
    ];
  };

  return (
    <ResourceFormPage<VatValues>
      key={`${data.mode}-${JSON.stringify(data.values)}`}
      title={data.title}
      breadcrumb={["Advance Settings", "VAT Registration Settings"]}
      mode={data.mode}
      apiPath={API}
      basePath="/vat_registration_settings/vat_registration_settings"
      submitUrl={API}
      submitMethod="PUT"
      allowSaveAndAdd={false}
      useFields={useFields}
      defaultValues={data.values}
      onSaved={reload}
    />
  );
}
