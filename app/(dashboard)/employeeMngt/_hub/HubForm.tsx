"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import { authFetch } from "@/lib/auth/authFetch";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import { HUB_DEFS } from "@/lib/employeeMngt/hub/hubDefs";
import { fieldIsHidden, fieldIsRequired } from "@/lib/employeeMngt/hub/hubFields";
import { HUB_SCREENS, hubBase, type HubFormModel, type HubOption, type HubScreenKey, type HubValues } from "@/lib/employeeMngt/hub/hubTypes";
import { useInit } from "../../systmMngt/_shared/useInit";

/**
 * CI employeeMngt/<screen>::initForm (formview_v) for the Employee Hub record screens: the employee
 * (a normal user: always themself; fixed on edit), then the screen's fields in CI order. A screen with
 * an attachment uploads the chosen file once the record is saved. Rules: lib/employeeMngt/hub.
 */
const opts = (list: HubOption[] | undefined) => (list ?? []).map((o) => ({ value: String(o.value), label: o.label }));

async function download(api: string, id: string) {
  try {
    const res = await authFetch(`${api}/${encodeURIComponent(id)}/file`);
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(json?.message ?? "Document Not Found!!");
    }
    const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "document";
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Download failed.");
  }
}

/** The record's current attachment on the edit form: download or detach it. */
function CurrentAttachment({ api, id }: { api: string; id: string }) {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    authFetch(`${api}/${encodeURIComponent(id)}`)
      .then((res) => res.json())
      .then((json) => !cancelled && setName(json.success ? String(json.data?.attachmentName ?? "") : ""))
      .catch(() => !cancelled && setName(""));
    return () => {
      cancelled = true;
    };
  }, [api, id]);

  if (!name) return null;
  const remove = async () => {
    const res = await authFetch(`${api}/${encodeURIComponent(id)}/file`, { method: "DELETE" });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) return toast.error(json?.message ?? "Could not remove the attachment.");
    toast.success("Attachment removed.");
    setName("");
  };
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-[#535768] dark:text-[#aab3c5]">
      <span>
        Current attachment: <strong className="text-[#1a1818] dark:text-[#e6e9f0]">{name}</strong>
      </span>
      <button type="button" className="text-[#0b5394] underline dark:text-[#8cb8f0]" onClick={() => download(api, id)}>
        Download
      </button>
      <button type="button" className="text-red-600 underline" onClick={remove}>
        Remove
      </button>
    </div>
  );
}

type EmployeeOptions = { options: Record<string, HubOption[]>; extras: Record<string, Record<string, Record<string, unknown>>> };
const NO_EMPLOYEE_OPTIONS: EmployeeOptions = { options: {}, extras: {} };

export default function HubForm({ screen, mode, id, emp }: { screen: HubScreenKey; mode: "add" | "edit"; id?: string; emp?: string }) {
  const info = HUB_SCREENS[screen];
  const defs = HUB_DEFS[screen];
  const api = `/api/employeeMngt/${screen}`;
  const router = useRouter();
  const pendingFile = useRef<File | undefined>(undefined);
  const { data, error } = useInit<HubFormModel>(id ? `${api}/form?id=${encodeURIComponent(id)}` : `${api}/form`);
  // Dropdowns of the chosen employee (their relatives…), reloaded when the employee changes.
  const [perEmployee, setPerEmployee] = useState<EmployeeOptions>(NO_EMPLOYEE_OPTIONS);
  const loadedFor = useRef<string | null>(null);
  const lastPick = useRef<string | null>(null);
  if (error) return <p className="p-6 text-sm text-red-500">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-gray-400">Loading…</p>;

  const useEmployeeEffects = (form: UseFormReturn<HubValues>) => {
    const employee = String(form.watch("EMP_ID") ?? "");
    useEffect(() => {
      if (!defs.employeeOptions || !employee || loadedFor.current === employee) return;
      loadedFor.current = employee;
      const query = new URLSearchParams({ emp: employee, ...(id ? { id } : {}) });
      authFetch(`${api}/employee-options?${query}`)
        .then((res) => res.json())
        .then((json) => json.success && loadedFor.current === employee && setPerEmployee(json.data as EmployeeOptions))
        .catch(() => toast.error("Could not load the employee's details."));
    }, [employee]);

    const prefill = defs.prefill;
    const pick = prefill ? String(form.watch(prefill.field) ?? "") : "";
    useEffect(() => {
      if (!prefill) return;
      const previous = lastPick.current;
      lastPick.current = pick;
      // Only a choice the user makes (not the record loading) fills the fields; "new" leaves them as typed.
      if (previous === null || !pick || pick === previous) return;
      const details = perEmployee.extras[prefill.extras]?.[pick];
      if (!details) return;
      for (const [field, key] of Object.entries(prefill.set)) {
        form.setValue(field, String(details[key] ?? ""), { shouldDirty: true });
      }
    }, [pick, form, prefill]);
  };

  const fileField = defs.fields.find((f) => f.type === "file");
  const defaults: HubValues = { EMP_ID: data.restricted ? String(data.ownEmployeeId ?? "") : (emp ?? "") };
  for (const f of defs.fields) if (f.type !== "file") defaults[f.name] = f.type === "checkbox" ? false : "";

  const useFields = (v: HubValues): DynamicField[] => [
    {
      name: "EMP_ID",
      label: defs.employeeLabel ?? "Employee Full Name",
      type: "select",
      options: opts(data.employees),
      required: true,
      // CI: fixed for a normal user and on edit.
      disabled: data.restricted || mode === "edit",
    },
    ...defs.fields.map((f): DynamicField => ({
      name: f.name,
      label: f.label,
      type: f.type,
      required: fieldIsRequired(f, v, data.flags),
      options: f.type === "select" ? opts(f.options ? (perEmployee.options[f.options] ?? data.options[f.options]) : []) : undefined,
      placeholder: f.placeholder,
      hidden: fieldIsHidden(f, v, data.flags),
      disabled: mode === "edit" && !!f.lockedOnEdit,
      attribute: f.attribute,
    })),
  ];

  const base = hubBase(screen);
  const listPath = emp ? `${base}?emp=${emp}` : base;

  // The file goes up in its own multipart request once the record has an id.
  const toPayload = fileField
    ? (values: HubValues) => {
        const { [fileField.name]: picked, ...rest } = values as Record<string, unknown>;
        delete rest.attachmentName; // shown on the form, never posted back
        pendingFile.current = picked instanceof FileList && picked.length ? picked[0] : undefined;
        return rest;
      }
    : undefined;
  const onSaved = fileField
    ? async (saved: unknown) => {
        const recordId = (saved as { id?: number } | null)?.id ?? id;
        const file = pendingFile.current;
        if (file && recordId) {
          const body = new FormData();
          body.append("file", file);
          const res = await authFetch(`${api}/${recordId}/file`, { method: "POST", body });
          const json = await res.json().catch(() => null);
          if (!res.ok || !json?.success) {
            toast.error(`Saved, but the attachment was not uploaded: ${json?.message ?? "upload failed."}`);
            router.push(`${base}/edit/${recordId}${emp ? `?emp=${emp}` : ""}`);
            return;
          }
        }
        router.push(listPath);
      }
    : undefined;

  return (
    <ResourceFormPage<HubValues>
      title={`${mode === "add" ? "Add" : "Edit"} ${info.noun}`}
      breadcrumb={["Employee Hub", info.title]}
      mode={mode}
      id={id}
      apiPath={api}
      basePath={listPath}
      objectName={info.objectName}
      useFields={useFields}
      defaultValues={defaults}
      toPayload={toPayload}
      onSaved={onSaved}
      allowSaveAndAdd={!fileField}
      useFormEffects={defs.employeeOptions || defs.prefill ? useEmployeeEffects : undefined}
    >
      {fileField && mode === "edit" && id ? <CurrentAttachment api={api} id={id} /> : null}
    </ResourceFormPage>
  );
}
