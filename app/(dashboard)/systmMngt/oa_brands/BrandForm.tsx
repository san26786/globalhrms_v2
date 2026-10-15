"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import type { BrandFormInit, BrandValues } from "@/lib/systmMngt/oaBrands";
import BrandTabs from "../_shared/BrandTabs";
import FormShell, { Row, selectCls } from "../_shared/FormShell";
import { saveForm, useInit } from "../_shared/useInit";

/**
 * CI oa_brands initForm (formview_v): brand identity, contact and address, business, dates, tax payment,
 * bank details, brand URL, logo, active / primary — with CI's brand tabs. For a normal user (CI
 * is_admin 0) name, code, reference, country, active and primary are locked.
 */
const API = "/api/systmMngt/oa_brands";

type TextKey = Exclude<keyof BrandValues, "isActive" | "isPrimary">;
type SelectKey = "compType" | "curr_name" | "country" | "businessCategory" | "taxpaymeth";

function Editor({ init, id }: { init: BrandFormInit; id: string }) {
  const router = useRouter();
  const [v, setV] = useState(init.values);
  const [logo, setLogo] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const locked = new Set<keyof BrandValues>(init.restricted ? ["OaBrandNm", "OaBrandCd", "RefId", "country", "isActive", "isPrimary"] : []);
  const back = init.restricted ? "/dashboard" : "/systmMngt/oa_brands";

  const save = async () => {
    const form = new FormData();
    for (const [k, val] of Object.entries(v)) form.set(k, typeof val === "boolean" ? (val ? "1" : "0") : val);
    if (logo) form.set("userfile", logo);
    setBusy(true);
    const r = await saveForm(`${API}/${encodeURIComponent(id)}`, "PUT", form);
    setBusy(false);
    if (!r.ok) return setErrors(r.errors);
    router.push(back);
  };

  const text = (key: TextKey, label: string, opts: { required?: boolean; type?: string; placeholder?: string } = {}) => (
    <Row key={key} label={label} htmlFor={key} required={opts.required} error={errors[key]}>
      <Input
        id={key}
        type={opts.type ?? "text"}
        placeholder={opts.placeholder}
        value={v[key]}
        readOnly={locked.has(key)}
        className={locked.has(key) ? "bg-slate-50" : undefined}
        onChange={(e) => setV((p) => ({ ...p, [key]: e.target.value }))}
      />
    </Row>
  );
  const select = (key: SelectKey, label: string, options: Array<{ value: number; label: string }>, required = false) => (
    <Row key={key} label={label} htmlFor={key} required={required} error={errors[key]}>
      <select id={key} className={selectCls} value={v[key]} disabled={locked.has(key)} onChange={(e) => setV((p) => ({ ...p, [key]: e.target.value }))}>
        <option value="">Select an option</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </Row>
  );
  const section = (title: string) => <h2 className="col-span-full border-b border-slate-100 pb-1 pt-2 text-sm font-semibold text-slate-500">{title}</h2>;

  return (
    <div>
      <div className="mx-auto max-w-5xl px-4 pt-4">
        <BrandTabs brandId={init.oaBrandId} active="brand" />
      </div>
      <FormShell title={init.title} breadcrumb={["System Manager", "Oa Brands"]} mode="edit" busy={busy} onSave={save} onCancel={() => router.push(back)}>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("OaBrandNm", "Organisation Name", { required: true })}
          {text("OaBrandCd", "Organisation Brand Code", { required: true })}
          {select("compType", "Company Type", init.options.companyTypes, true)}
          {select("curr_name", "Currency", init.options.currencies, true)}
          {text("RefId", "Refrence")}
          {text("telephone", "Telephone Number", { required: true })}
          {text("email", "Email", { required: true, type: "email" })}
          {text("website", "Website")}
          {text("contact", "Contact Person", { required: true })}

          {section("Address")}
          {text("address", "Company Address")}
          {text("address_line_1", "Address Line 1")}
          {text("address_line_2", "Address Line 2")}
          {text("town", "Town")}
          {text("state", "Region or State")}
          {text("postcode", "Post/Zip Code")}
          {select("country", "Country", init.options.countries, true)}

          {section("Business")}
          {select("businessCategory", "Business Category", init.options.businessCategories)}
          <Row label="Business Description" htmlFor="businessDesc" error={errors.businessDesc}>
            <textarea
              id="businessDesc"
              rows={3}
              placeholder="Please briefly tell us about your business."
              value={v.businessDesc}
              onChange={(e) => setV((p) => ({ ...p, businessDesc: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </Row>
          {text("startdate", "Date Of Formation(Start Date)", { type: "date" })}
          <Row label="Cessation Date(End Date)" htmlFor="cessationdate" error={errors.cessationdate}>
            <Input
              id="cessationdate"
              type="date"
              min={v.startdate || undefined}
              value={v.cessationdate}
              onChange={(e) => setV((p) => ({ ...p, cessationdate: e.target.value }))}
            />
          </Row>
          {select("taxpaymeth", "Tax Payment Method", init.options.taxPaymentMethods)}

          {section("Bank")}
          {text("bankname", "Bank Name")}
          {text("branchname", "Branch Name")}
          {text("sortcode", "Sort Code( For UK Only)")}
          {text("accname", "Account Name")}
          {text("accno", "Account Number")}
          {text("payref", "Payment Refrence")}
          {text("buildsref", "Building Society Refrence")}
          {text("bankphone", "Bank Telephone")}
          {text("bankadd", "Bank Address")}

          {section("Brand")}
          {text("brand_url", "Brand Url")}
          <Row label="Organization Brand Logo" htmlFor="userfile" error={errors.userfile}>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- served by the authenticated brand-logo route */}
              <img
                src={logo ? URL.createObjectURL(logo) : `/api/header/brand-logo/${init.oaBrandId}`}
                alt="Brand logo"
                className="h-12 w-auto max-w-[160px] rounded border border-slate-200 bg-white object-contain"
              />
              <input
                id="userfile"
                type="file"
                accept=".png,.jpg,.jpeg,.gif,.bmp,.jfif,.tiff"
                onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-1.5 file:text-sm file:font-medium file:text-blue-700"
              />
            </div>
          </Row>
        </div>
        <div className="flex flex-wrap gap-6">
          {(["isActive", "isPrimary"] as const).map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={v[k]} disabled={locked.has(k)} onChange={(e) => setV((p) => ({ ...p, [k]: e.target.checked }))} />
              {k === "isActive" ? "Is Active" : "Is Primary"}
            </label>
          ))}
        </div>
      </FormShell>
    </div>
  );
}

export default function BrandForm({ id }: { id: string }) {
  const { data, error } = useInit<BrandFormInit>(`${API}/${encodeURIComponent(id)}`);
  if (error) return <p className="p-6 text-sm text-red-500">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-gray-400">Loading…</p>;
  return <Editor init={data} id={id} />;
}
