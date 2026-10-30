"use client";

import { useState } from "react";
import { Copy } from "lucide-react";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import { Button } from "@/components/ui/button";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import {
  APPLICABLE_TAXES,
  ORDER_SCREENS,
  isOrderSettingId,
  type OrderSettingsModel,
  type OrderValues,
} from "@/lib/organisation/orderScreens";
import { runAction, useInit } from "../../systmMngt/_shared/useInit";

/**
 * CI organisation/invoice_setting initForm for Purchase Order (5569) / Sales Order (5570) Setting
 * (formview_v): organisation name / code / folder (read-only), currency, address, country, postal code,
 * registration / VAT numbers, prefix, bank details, instruction lines, "Mail Pdf" and the template;
 * India brands also see Food License, the applicable taxes, CST and PAN. Brand admins get "Sync
 * Setting" (copy the brand's Invoice Setting). Rules: lib/organisation/orderSettings.
 */
const API = "/api/organisation/invoice_setting";

type Form = OrderValues & { oa_brand_nm: string; oa_brand_cd: string; folder_loc: string };

const opts = (list: Array<{ value: number | string; label: string }>) => list.map((o) => ({ value: String(o.value), label: o.label }));

export default function OrderSettingsForm({ settingId }: { settingId: string }) {
  const screen = isOrderSettingId(settingId) ? ORDER_SCREENS[settingId] : null;
  const { data, error, reload } = useInit<OrderSettingsModel>(screen ? `${API}?settingId=${settingId}` : null);
  const [syncing, setSyncing] = useState(false);

  if (!screen) return <p className="p-6 text-sm text-red-500">This setting is not available.</p>;
  if (error) return <p className="p-6 text-sm text-red-500">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-gray-400">Loading…</p>;

  const disabled = !data.canSave;
  const text = (name: keyof Form, label: string, required = false, hidden = false): DynamicField => ({ name, label, type: "text", required, hidden, disabled });
  const readOnly = (name: keyof Form, label: string): DynamicField => ({ name, label, type: "text", readOnly: true, disabled: true });
  const line = (n: 1 | 2 | 3 | 4): DynamicField => ({ name: `instruction_line_${n}`, label: `Instruction Line ${n}`, type: "textarea", disabled });

  const fields: DynamicField[] = [
    readOnly("oa_brand_nm", "Organisation Name"),
    readOnly("oa_brand_cd", "Organisation Code"),
    { name: "org_currency_id", label: "Currency", type: "select", required: data.options.currencies.length > 0, options: opts(data.options.currencies), disabled },
    text("reg_address", "Register Address", true),
    text("reg_address_2", "Address Line 2"),
    text("reg_address_3", "Address Line 3"),
    text("city", "City", true),
    { name: "country", label: "Country", type: "select", required: true, options: opts(data.options.countries), disabled },
    text("postal_code", "Postal Code"),
    text("registration_no", "Registration No"),
    text("food_license", "Food License No.", false, !data.isIndia),
    text("vat_no", data.isIndia ? "GST No." : "VAT No"),
    readOnly("folder_loc", "Folder Location"),
    ...APPLICABLE_TAXES.map((t): DynamicField => ({ name: t.key, label: t.label, type: "checkbox", hidden: !data.isIndia, disabled })),
    text("cst", "CST", false, !data.isIndia),
    text("pan", "PAN", false, !data.isIndia),
    text("invoice_prefix", screen.prefixLabel, true),
    text("bank_name", "Bank Name"),
    text("account_name", "Account Name", true),
    text("account_no", "Account No"),
    text("sort_code", "Sort Code"),
    text("ifsc_code", "IFSC Code"),
    line(1),
    line(2),
    line(3),
    line(4),
    { name: "mail_pdf", label: "Mail Pdf", type: "checkbox", disabled },
    {
      name: "org_template",
      label: screen.templateLabel,
      type: "select",
      required: data.options.templates.length > 0,
      options: opts(data.options.templates),
      placeholder: data.options.templates.length ? undefined : "No templates available",
      disabled,
    },
  ];

  const sync = async () => {
    setSyncing(true);
    const done = await runAction(`${API}/sync?settingId=${settingId}`, {
      method: "POST",
      confirm: `Replace this ${screen.title} with a copy of the Invoice Setting?`,
    });
    setSyncing(false);
    if (done) reload();
  };

  return (
    <ResourceFormPage<Form>
      key={`${data.mode}-${JSON.stringify(data.values)}`}
      title={data.title}
      breadcrumb={["Advance Settings", screen.title]}
      mode={data.mode}
      apiPath={API}
      basePath={`/organisation/invoice_setting?settingId=${settingId}`}
      submitUrl={`${API}?settingId=${settingId}`}
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
    >
      {data.canSync && (
        <div className="mb-4 flex justify-end">
          <Button type="button" variant="outline" className="rounded-full" disabled={syncing} onClick={() => void sync()}>
            <Copy aria-hidden="true" className="mr-2 h-4 w-4" />
            {syncing ? "Syncing…" : "Sync Setting"}
          </Button>
        </div>
      )}
    </ResourceFormPage>
  );
}
