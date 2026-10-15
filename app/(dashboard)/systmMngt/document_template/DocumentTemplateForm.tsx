"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import RichTextEditor from "@/components/forms/RichTextEditor";
import type { DocumentTemplateInit } from "@/lib/systmMngt/documentTemplates";
import FormShell, { Row, selectCls } from "../_shared/FormShell";
import { saveForm, useInit } from "../_shared/useInit";

/**
 * CI systmMngt/document_template initForm (formview_v + CKEditor): the template (DTN master) and its
 * HTML body. Placeholders are typed as **VARIABLE** (CI had no insert UI either); which column
 * fills each is configured in Document Template Variables.
 */
const API = "/api/systmMngt/document_template";
const LIST = "/systmMngt/document_template";

function Editor({ init, id }: { init: DocumentTemplateInit; id?: string }) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(init.values?.template_id ?? "");
  const [body, setBody] = useState(init.values?.template_body ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const save = async (andAdd: boolean) => {
    setBusy(true);
    const r = await saveForm(id ? `${API}/${encodeURIComponent(id)}` : API, id ? "PUT" : "POST", { template_id: templateId, template_body: body });
    setBusy(false);
    if (!r.ok) return setErrors(r.errors);
    if (andAdd) {
      setTemplateId("");
      setBody("");
      setErrors({});
      setFormKey((k) => k + 1);
    } else router.push(LIST);
  };

  return (
    <FormShell
      key={formKey}
      title={init.title}
      breadcrumb={["System Manager", "Document Template"]}
      mode={init.mode}
      busy={busy}
      onSave={() => save(false)}
      onSaveAndAdd={() => save(true)}
      onCancel={() => router.push(LIST)}
    >
      <Row label="Template" htmlFor="template_id" required error={errors.template_id}>
        <select id="template_id" className={selectCls} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
          <option value="">Select an option</option>
          {init.templates.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </Row>
      <Row label="Template Body" htmlFor="template_body" error={errors.template_body}>
        <RichTextEditor id="template_body" value={body} onChange={setBody} />
      </Row>
    </FormShell>
  );
}

export default function DocumentTemplateForm({ mode, id }: { mode: "add" | "edit"; id?: string }) {
  const { data, error } = useInit<DocumentTemplateInit>(`${API}/init${mode === "edit" && id ? `?id=${encodeURIComponent(id)}` : ""}`);
  if (error) return <p className="p-6 text-sm text-red-500">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-gray-400">Loading…</p>;
  return <Editor init={data} id={mode === "edit" ? id : undefined} />;
}
