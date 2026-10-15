"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import SearchableSelect from "@/components/forms/SearchableSelect";
import { Input } from "@/components/ui/input";
import type { BrandSettingInit, BrandSettingValues } from "@/lib/systmMngt/oaBrandSettings";
import FormShell, { Row, selectCls } from "../_shared/FormShell";
import { saveForm, useInit } from "../_shared/useInit";

/**
 * CI oa_brand_settings initForm (formview_v + js/systmMngt/oa_brand_settings.js): attribute ("Oabs
 * Code"), Setting Value — one of the four date formats for Date Format, otherwise a pick from the
 * setting value list or, ticked "custom value", free text — Brand, Ref, Description, Validation, Active.
 */
const API = "/api/systmMngt/oa_brand_settings";

function listHref(brandId: string, kind: BrandSettingInit["kind"]) {
  const qs = new URLSearchParams({ ...(brandId ? { brandId } : {}), ...(kind === "attributes" ? { type: "ATTR" } : {}) }).toString();
  return `/systmMngt/oa_brand_settings${qs ? `?${qs}` : ""}`;
}

function Editor({ init, id }: { init: BrandSettingInit; id?: string }) {
  const router = useRouter();
  const [v, setV] = useState<BrandSettingValues>(init.values);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof BrandSettingValues>(k: K, value: BrandSettingValues[K]) => setV((p) => ({ ...p, [k]: value }));
  const isDateFormat = init.dateFormatAttributeId !== null && v.attributeId === String(init.dateFormatAttributeId);
  const back = listHref(init.values.brandId, init.kind);

  const save = async (andAdd: boolean) => {
    setBusy(true);
    const r = await saveForm(id ? `${API}/${encodeURIComponent(id)}` : API, id ? "PUT" : "POST", { ...v, kind: init.kind });
    setBusy(false);
    if (!r.ok) return setErrors(r.errors);
    if (andAdd) {
      setV({ ...init.values, attributeId: "", optionId: "", customValue: "", isCustom: false, refId: "", description: "", validation: "" });
      setErrors({});
    } else router.push(back);
  };

  return (
    <FormShell
      title={init.title}
      breadcrumb={["System Manager", init.kind === "attributes" ? "Company Attributes" : "Company Settings"]}
      mode={init.mode}
      busy={busy}
      onSave={() => save(false)}
      onSaveAndAdd={() => save(true)}
      onCancel={() => router.push(back)}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Row label="Oabs Code" htmlFor="attributeId" required error={errors.attributeId}>
          <select id="attributeId" className={selectCls} value={v.attributeId} onChange={(e) => set("attributeId", e.target.value)}>
            <option value="">Select an option</option>
            {init.attributes.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </Row>

        {isDateFormat ? (
          <Row label="Setting Value" htmlFor="dateFormat" error={errors.customValue}>
            <select id="dateFormat" className={selectCls} value={v.customValue} onChange={(e) => set("customValue", e.target.value)}>
              <option value="">Select an option</option>
              {init.dateFormats.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </Row>
        ) : (
          <Row label="Setting Value" error={errors.customValue ?? errors.optionId}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                {v.isCustom ? (
                  <Input aria-label="Setting Value" value={v.customValue} onChange={(e) => set("customValue", e.target.value)} />
                ) : (
                  <SearchableSelect
                    ariaLabel="Setting Value"
                    placeholder="Select an option"
                    emptyValue=""
                    className="w-full"
                    value={v.optionId}
                    options={init.options.map((o) => ({ value: String(o.value), label: o.label }))}
                    onChange={(x) => set("optionId", x)}
                  />
                )}
              </div>
              <label className="flex items-center gap-1.5 text-sm text-slate-600" title="Tick to enter custom value">
                <input type="checkbox" checked={v.isCustom} onChange={(e) => set("isCustom", e.target.checked)} />
                Custom value
              </label>
            </div>
          </Row>
        )}

        <Row label="Brand" htmlFor="brandId" required error={errors.brandId}>
          <select id="brandId" className={selectCls} value={v.brandId} onChange={(e) => set("brandId", e.target.value)}>
            <option value="">Select an option</option>
            {init.brands.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </Row>
        <Row label="Ref" htmlFor="refId" error={errors.refId}>
          <Input id="refId" inputMode="numeric" value={v.refId} onChange={(e) => set("refId", e.target.value)} />
        </Row>
        <Row label="Validation" htmlFor="validation" error={errors.validation}>
          <Input id="validation" value={v.validation} onChange={(e) => set("validation", e.target.value)} />
        </Row>
      </div>
      <Row label="Description" htmlFor="description" error={errors.description}>
        <textarea
          id="description"
          rows={3}
          value={v.description}
          onChange={(e) => set("description", e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Row>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={v.isActive} onChange={(e) => set("isActive", e.target.checked)} />
        Active
      </label>
    </FormShell>
  );
}

export default function BrandSettingForm({ mode, id, brandId, type }: { mode: "add" | "edit"; id?: string; brandId?: string; type?: string }) {
  const qs = new URLSearchParams({
    ...(mode === "edit" && id ? { id } : {}),
    ...(brandId ? { brandId } : {}),
    ...(type ? { type } : {}),
  }).toString();
  const { data, error } = useInit<BrandSettingInit>(`${API}/init${qs ? `?${qs}` : ""}`);
  if (error) return <p className="p-6 text-sm text-red-500">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-gray-400">Loading…</p>;
  return <Editor init={data} id={mode === "edit" ? id : undefined} />;
}
