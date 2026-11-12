"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import { authFetch } from "@/lib/auth/authFetch";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import { HUB_DEFS } from "@/lib/employeeMngt/hub/hubDefs";
import { fieldIsHidden, fieldIsRequired, type HubExtras } from "@/lib/employeeMngt/hub/hubFields";
import { HUB_SCREENS, hubBase, type HubFormModel, type HubOption, type HubScreenKey, type HubValues } from "@/lib/employeeMngt/hub/hubTypes";
import { useInit } from "../../systmMngt/_shared/useInit";

/**
 * CI employeeMngt/<screen>::initForm (formview_v) for the Employee Hub record screens: the employee
 * (a normal user: always themself; fixed on edit), then the screen's fields in CI order. A screen with
 * an attachment uploads the chosen file once the record is saved. Rules: lib/employeeMngt/hub.
 */
const opts = (list: HubOption[] | undefined) => (list ?? []).map((o) => ({ value: String(o.value), label: o.label }));
/** The options of a dependent select that belong to the chosen parent value (all of them until one is chosen). */
const choices = (list: HubOption[] | undefined, parent: string | boolean | undefined) =>
  parent === undefined || parent === "" ? (list ?? []) : (list ?? []).filter((o) => o.parent === undefined || String(o.parent) === String(parent));

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

/** The record's current attachment on the edit form: download or detach it; a picture is shown. */
function CurrentAttachment({ api, id, image, removable }: { api: string; id: string; image?: boolean; removable: boolean }) {
  const [name, setName] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
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
  useEffect(() => {
    if (!image || !name) return;
    let url: string | null = null;
    authFetch(`${api}/${encodeURIComponent(id)}/file`)
      .then((res) => (res.ok && res.headers.get("Content-Type")?.startsWith("image/") ? res.blob() : null))
      .then((blob) => {
        if (!blob) return;
        url = URL.createObjectURL(blob);
        setPreview(url);
      })
      .catch(() => undefined);
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [api, id, image, name]);

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
      {/* eslint-disable-next-line @next/next/no-img-element -- an authenticated blob URL */}
      {preview ? <img src={preview} alt="Current picture" className="h-24 w-24 rounded-lg border border-slate-200 object-cover dark:border-white/10" /> : null}
      <span>
        Current attachment: <strong className="text-[#1a1818] dark:text-[#e6e9f0]">{name}</strong>
      </span>
      <button type="button" className="text-[#0b5394] underline dark:text-[#8cb8f0]" onClick={() => download(api, id)}>
        Download
      </button>
      {removable ? (
        <button type="button" className="text-red-600 underline" onClick={remove}>
          Remove
        </button>
      ) : null}
    </div>
  );
}

/** `for`: the employee they were loaded for. */
type EmployeeOptions = { options: Record<string, HubOption[]>; extras: HubExtras; for?: string };
const NO_EMPLOYEE_OPTIONS: EmployeeOptions = { options: {}, extras: {} };

/**
 * `back`: the list to return to (a worklist that opened this form, e.g. Confirmation Pending).
 * `next`: where a save goes instead, for the saved employee (CI "Save And Next"); Cancel still goes back.
 */
export default function HubForm({
  screen,
  mode,
  id,
  emp,
  back,
  next,
}: {
  screen: HubScreenKey;
  mode: "add" | "edit";
  id?: string;
  emp?: string;
  back?: string;
  next?: (employee: string) => string;
}) {
  const info = HUB_SCREENS[screen];
  const defs = HUB_DEFS[screen];
  const api = `/api/employeeMngt/${screen}`;
  const router = useRouter();
  const pendingFile = useRef<File | undefined>(undefined);
  const savedEmployee = useRef("");
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
        .then((json) => json.success && loadedFor.current === employee && setPerEmployee({ ...(json.data as EmployeeOptions), for: employee }))
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
  Object.assign(defaults, data.defaults);

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
      // A required file is required when adding; on edit the saved one stays unless replaced.
      required: fieldIsRequired(f, v, data.flags) && (f.type !== "file" || mode === "add"),
      options: f.type === "select" ? opts(choices(f.options ? (perEmployee.options[f.options] ?? data.options[f.options]) : [], f.dependsOn ? v[f.dependsOn] : undefined)) : undefined,
      placeholder: f.placeholder,
      hidden: fieldIsHidden(f, v, data.flags),
      disabled: (mode === "edit" && !!f.lockedOnEdit) || !!f.readOnly?.(v, data.flags),
      attribute: f.attribute,
    })),
  ];

  const notices = defs.notices && perEmployee.for ? defs.notices(perEmployee.extras, { EMP_ID: perEmployee.for }) : [];

  const base = hubBase(screen);
  const listPath = back && back.startsWith("/") && !back.startsWith("//") ? back : emp ? `${base}?emp=${emp}` : base;

  // The file goes up in its own multipart request once the record has an id.
  const withoutFile = fileField
    ? (values: HubValues) => {
        const { [fileField.name]: picked, ...rest } = values as Record<string, unknown>;
        delete rest.attachmentName; // shown on the form, never posted back
        pendingFile.current = picked instanceof FileList && picked.length ? picked[0] : undefined;
        return rest;
      }
    : undefined;
  const toPayload = next
    ? (values: HubValues) => {
        savedEmployee.current = String(values.EMP_ID ?? "");
        return withoutFile ? withoutFile(values) : values;
      }
    : withoutFile;
  const afterSave = () => (next && savedEmployee.current ? next(savedEmployee.current) : listPath);
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
        router.push(afterSave());
      }
    : next
      ? () => router.push(afterSave())
      : undefined;

  return (
    <ResourceFormPage<HubValues>
      title={`${mode === "add" ? "Add" : "Edit"} ${info.noun}`}
      breadcrumb={[info.section ?? "Employee Hub", info.title]}
      mode={mode}
      id={id}
      apiPath={api}
      basePath={listPath}
      objectName={info.objectName}
      useFields={useFields}
      defaultValues={defaults}
      toPayload={toPayload}
      onSaved={onSaved}
      allowSaveAndAdd={!fileField && !next}
      useFormEffects={defs.employeeOptions || defs.prefill ? useEmployeeEffects : undefined}
    >
      {notices.length ? (
        <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          {notices.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </div>
      ) : null}
      {fileField && mode === "edit" && id ? <CurrentAttachment api={api} id={id} image={defs.file?.image} removable={!defs.file?.required} /> : null}
    </ResourceFormPage>
  );
}
