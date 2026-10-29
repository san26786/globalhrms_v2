"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/auth/authFetch";
import type { CompanyDocumentInit } from "@/lib/systmMngt/companyDocuments";
import FormShell, { Row, selectCls } from "../_shared/FormShell";
import { saveForm, useInit } from "../_shared/useInit";

/**
 * CI user/member_file_upload initForm, BRAND_ID path (what "Company Documents" Add / Edit opened):
 * Document Type (fixed: Company Document), Category → Sub Category (CI getMastersByCategory cascade),
 * File Name, the file, Is Public and a User Group. The CI form's DMS SOAP push is not ported.
 */
const API = "/api/systmMngt/company_documents";
const LIST = "/systmMngt/company_documents";

type IdLabel = { value: number; label: string };

function Editor({ init, id }: { init: CompanyDocumentInit; id?: string }) {
  const router = useRouter();
  const v = init.values;
  const [fileName, setFileName] = useState(v?.fileName ?? "");
  const [category, setCategory] = useState(v?.docCategory ?? "");
  const [subCategory, setSubCategory] = useState(v?.master ?? "");
  const [subCategories, setSubCategories] = useState<IdLabel[]>([]);
  const [isPublic, setIsPublic] = useState(v?.isPublic ?? false);
  const [userGroup, setUserGroup] = useState(v?.userGroup ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!category) return;
    let cancelled = false;
    authFetch(`${API}/sub-categories/${encodeURIComponent(category)}`)
      .then((res) => res.json())
      .then((json: { success?: boolean; data?: IdLabel[] }) => !cancelled && setSubCategories(json.success && json.data ? json.data : []))
      .catch(() => !cancelled && setSubCategories([]));
    return () => {
      cancelled = true;
    };
  }, [category]);

  const save = async (andAdd: boolean) => {
    const form = new FormData();
    form.set("fileName", fileName);
    form.set("docCategory", category);
    form.set("master", subCategory);
    form.set("isPublic", isPublic ? "1" : "0");
    form.set("userGroup", userGroup);
    if (file) form.set("userfile", file);
    setBusy(true);
    const r = await saveForm(id ? `${API}/${encodeURIComponent(id)}` : API, id ? "PUT" : "POST", form);
    setBusy(false);
    if (!r.ok) return setErrors(r.errors);
    if (andAdd) {
      setFileName("");
      setCategory("");
      setSubCategory("");
      setIsPublic(false);
      setUserGroup("");
      setFile(null);
      setFileKey((k) => k + 1);
      setErrors({});
    } else router.push(LIST);
  };

  return (
    <FormShell
      title={init.title}
      breadcrumb={["System Manager", "Company Documents"]}
      mode={init.mode}
      busy={busy}
      onSave={() => save(false)}
      onSaveAndAdd={() => save(true)}
      onCancel={() => router.push(LIST)}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Row label="Document Type" htmlFor="type">
          <select id="type" className={selectCls} disabled value={init.docType ? String(init.docType.value) : ""}>
            {init.docType && <option value={init.docType.value}>{init.docType.label}</option>}
          </select>
        </Row>
        <Row label="File Name" htmlFor="fileName" required error={errors.fileName}>
          <Input id="fileName" value={fileName} onChange={(e) => setFileName(e.target.value)} />
        </Row>
        <Row label="Document Category" htmlFor="docCategory" error={errors.docCategory}>
          <select
            id="docCategory"
            className={selectCls}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setSubCategory("");
              if (!e.target.value) setSubCategories([]);
            }}
          >
            <option value="">Select an option</option>
            {init.categories.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </Row>
        <Row label="Document Sub Category" htmlFor="master" error={errors.master}>
          <select id="master" className={selectCls} value={subCategory} onChange={(e) => setSubCategory(e.target.value)}>
            <option value="">Select an option</option>
            {subCategories.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </Row>
        <Row label="Upload File" htmlFor="userfile" required error={errors.userfile}>
          <input
            key={fileKey}
            id="userfile"
            type="file"
            accept={init.allowedExtensions.map((e) => `.${e}`).join(",")}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-[#323338] dark:text-[#d5dae4] file:mr-3 file:rounded-full file:border-0 file:bg-[#fbe6dd] dark:file:bg-[#da5427]/15 file:px-4 file:py-1.5 file:text-sm file:font-medium file:text-[#7a2e12] dark:file:text-[#f8d3c3]"
          />
          {v?.imageName && !file && <p className="text-xs text-[#535768] dark:text-[#aab3c5]">Current file: {v.imageName}</p>}
        </Row>
        <Row label="User Group" htmlFor="userGroup" error={errors.userGroup}>
          <select id="userGroup" className={selectCls} value={userGroup} onChange={(e) => setUserGroup(e.target.value)}>
            <option value="">Select an option</option>
            {init.userGroups.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </Row>
      </div>
      <label className="flex items-center gap-2 text-sm text-[#1a1818] dark:text-[#e6e9f0]">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        Is Public
      </label>
    </FormShell>
  );
}

export default function CompanyDocumentForm({ mode, id }: { mode: "add" | "edit"; id?: string }) {
  const { data, error } = useInit<CompanyDocumentInit>(`${API}/init${mode === "edit" && id ? `?id=${encodeURIComponent(id)}` : ""}`);
  if (error) return <p className="p-6 text-sm text-rose-700 dark:text-rose-300">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-[#535768] dark:text-[#aab3c5]">Loading…</p>;
  return <Editor init={data} id={mode === "edit" ? id : undefined} />;
}
