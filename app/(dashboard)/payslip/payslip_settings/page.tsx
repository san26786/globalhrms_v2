"use client";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import type { PayslipSettingsModel, PayslipValues } from "@/lib/systmMngt/payslipSettings";
import { useInit } from "../../systmMngt/_shared/useInit";

/**
 * CI payslip/payslip_settings ("Salary Slip Setting", formview_v): the brand's payslip header —
 * brand name / code / folder (read-only), prefix, currency, registered address, country, registration
 * and VAT numbers, bank account, four instruction lines, "Mail Pdf" and the payslip template.
 * Rules: lib/systmMngt/payslipSettings.
 */
const API = "/api/payslip/payslip_settings";

type Form = PayslipValues & { oa_brand_nm: string; oa_brand_cd: string; folder_loc: string };

const opts = (list: Array<{ value: number; label: string }>) => list.map((o) => ({ value: String(o.value), label: o.label }));

export default function PayslipSettingsPage() {
  const { data, error, reload } = useInit<PayslipSettingsModel>(API);
  if (error) return <p className="p-6 text-sm text-red-500">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-gray-400">Loading…</p>;

  const text = (name: keyof Form, label: string, required = false): DynamicField => ({ name, label, type: "text", required, disabled: !data.canSave });
  const readOnly = (name: keyof Form, label: string): DynamicField => ({ name, label, type: "text", readOnly: true, disabled: true });

  const fields: DynamicField[] = [
    readOnly("oa_brand_nm", "Brand Name"),
    readOnly("oa_brand_cd", "Brand Code"),
    readOnly("folder_loc", "Folder Loc"),
    text("prefix", "Prefix", true),
    { name: "currency_id", label: "Currency", type: "select", options: opts(data.options.currencies), disabled: !data.canSave },
    text("reg_address", "Reg Address", true),
    text("reg_address_2", "Reg Address 2"),
    text("reg_address_3", "Reg Address 3"),
    text("postal_code", "Postal Code"),
    text("city", "City"),
    { name: "country", label: "Country", type: "select", options: opts(data.options.countries), disabled: !data.canSave },
    text("registration_no", "Registration No"),
    text("vat_no", "Vat No"),
    text("account_name", "Account Name", true),
    text("account_no", "Account No"),
    text("sort_code", "Sort Code"),
    text("instruction_line_1", "Instruction Line 1"),
    text("instruction_line_2", "Instruction Line 2"),
    text("instruction_line_3", "Instruction Line 3"),
    text("instruction_line_4", "Instruction Line 4"),
    { name: "mail_pdf", label: "Mail Pdf", type: "checkbox", disabled: !data.canSave },
    { name: "payslip_template", label: "Select Payslip Template", type: "select", required: true, options: opts(data.options.templates), disabled: !data.canSave },
  ];

  return (
    <ResourceFormPage<Form>
      key={`${data.mode}-${JSON.stringify(data.values)}`}
      title={data.title}
      breadcrumb={["Payroll", "Salary Slip Setting"]}
      mode={data.mode}
      apiPath={API}
      basePath="/payslip/payslip_settings"
      submitUrl={API}
      submitMethod="PUT"
      allowSaveAndAdd={false}
      fields={fields}
      defaultValues={{ ...data.values, oa_brand_nm: data.brand.name, oa_brand_cd: data.brand.code, folder_loc: data.brand.folder }}
      toPayload={({ oa_brand_nm: _n, oa_brand_cd: _c, folder_loc: _f, ...rest }) => {
        void _n;
        void _c;
        void _f;
        return rest;
      }}
      onSaved={reload}
    />
  );
}
