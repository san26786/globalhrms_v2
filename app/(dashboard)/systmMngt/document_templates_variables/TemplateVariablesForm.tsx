"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import SearchableSelect from "@/components/forms/SearchableSelect";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/auth/authFetch";
import type { TemplateVariablesInit, VariableRow } from "@/lib/systmMngt/documentTemplates";
import FormShell, { Row, selectCls } from "../_shared/FormShell";
import { saveForm, useInit } from "../_shared/useInit";

/**
 * CI systmMngt/document_templates_variables initForm (+ js/.../document_templates_variables.js):
 * Template and View; once both are chosen, one row per template variable (read-only name) with a
 * column picker of the view's columns (CI getVariables). Editing shows only the record's variable.
 */
const API = "/api/systmMngt/document_templates_variables";
const LIST = "/systmMngt/document_templates_variables";

function Editor({ init, id }: { init: TemplateVariablesInit; id?: string }) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(init.values?.template_id ?? "");
  const [view, setView] = useState(init.values?.view_name ?? "");
  const [rows, setRows] = useState<VariableRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  // The (template, view) whose rows are shown; loading while it differs from the current one.
  const [loadedKey, setLoadedKey] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // CI callVariableTemplates(): reload the rows whenever template or view changes.
  useEffect(() => {
    if (!templateId || !view) return;
    let cancelled = false;
    const qs = new URLSearchParams({ templateId, view, ...(id ? { id } : {}) });
    const key = qs.toString();
    authFetch(`${API}/variables?${qs}`)
      .then((res) => res.json())
      .then((json: { success?: boolean; message?: string; data?: { rows: VariableRow[]; columns: string[] } }) => {
        if (cancelled) return;
        if (!json.success || !json.data) throw new Error(json.message ?? "Could not load the variables.");
        setRows(json.data.rows);
        setColumns(json.data.columns);
      })
      .catch((e: unknown) => !cancelled && setErrors({ rows: e instanceof Error ? e.message : "Could not load the variables." }))
      .finally(() => !cancelled && setLoadedKey(key));
    return () => {
      cancelled = true;
    };
  }, [templateId, view, id]);

  const save = async (andAdd: boolean) => {
    setBusy(true);
    const r = await saveForm(id ? `${API}/${encodeURIComponent(id)}` : API, id ? "PUT" : "POST", { template_id: templateId, view_name: view, rows });
    setBusy(false);
    if (!r.ok) return setErrors(r.errors);
    if (andAdd) {
      setTemplateId("");
      setView("");
      setRows([]);
      setErrors({});
    } else router.push(LIST);
  };

  const currentKey = templateId && view ? new URLSearchParams({ templateId, view, ...(id ? { id } : {}) }).toString() : "";
  const loading = currentKey !== "" && currentKey !== loadedKey;
  const shownRows = currentKey && !loading ? rows : [];

  return (
    <FormShell
      title={init.title}
      breadcrumb={["System Manager", "Document Template Variables"]}
      mode={init.mode}
      busy={busy}
      onSave={() => save(false)}
      onSaveAndAdd={() => save(true)}
      onCancel={() => router.push(LIST)}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Row label="Template" htmlFor="template_id" required error={errors.template_id}>
          <select id="template_id" className={selectCls} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">Select an option</option>
            {init.templates.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Row>
        <Row label="View" required error={errors.view_name}>
          <SearchableSelect
            ariaLabel="View"
            placeholder="Select an option"
            emptyValue=""
            className="w-full"
            value={view}
            options={init.views.map((v) => ({ value: v, label: v }))}
            onChange={setView}
          />
        </Row>
      </div>

      {errors.rows && <p className="text-sm text-red-600" role="alert">{errors.rows}</p>}
      {loading && <p className="text-sm text-slate-400">Loading variables…</p>}
      {!loading && templateId && view && shownRows.length === 0 && (
        <p className="text-sm text-slate-400">This template has no variables.</p>
      )}
      {shownRows.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3 text-xs font-semibold uppercase text-slate-500">
            <span>Variables</span>
            <span>Col</span>
          </div>
          {shownRows.map((r, i) => (
            <div key={`${r.variable}-${i}`} className="grid grid-cols-2 gap-3">
              <Input readOnly value={r.variable} aria-label={`Variable ${i + 1}`} className="bg-slate-50" />
              <select
                aria-label={`Column for ${r.variable}`}
                className={selectCls}
                value={r.column}
                onChange={(e) => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, column: e.target.value } : x)))}
              >
                <option value="">Select an option</option>
                {columns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </FormShell>
  );
}

export default function TemplateVariablesForm({ mode, id }: { mode: "add" | "edit"; id?: string }) {
  const { data, error } = useInit<TemplateVariablesInit>(`${API}/init${mode === "edit" && id ? `?id=${encodeURIComponent(id)}` : ""}`);
  if (error) return <p className="p-6 text-sm text-red-500">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-gray-400">Loading…</p>;
  return <Editor init={data} id={mode === "edit" ? id : undefined} />;
}
