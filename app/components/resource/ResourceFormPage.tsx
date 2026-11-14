"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm, type DefaultValues, type FieldValues, type Path, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";

import DynamicForm from "@/components/DynamicForm/DynamicForm";
import FormButtonBar, { type FormButtonResult } from "@/components/resource/FormButtonBar";
import FormChildTable from "@/components/resource/FormChildTable";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import { fillUrlTemplate, isFieldVisible } from "@/lib/form-builder/utils/visibility";
import type { FormInitPayload } from "@/lib/form-init/initForm";
import { authFetch } from "@/lib/auth/authFetch";
import { useListColumns } from "@/lib/entity/display/useListColumns";
import { useOptionsMap } from "@/lib/lookups/useOptions";

interface ResourceFormPageProps<TForm extends FieldValues, TDto> {
  /** Page heading. Optional with `initUrl` (the payload's title is used). */
  title?: string;
  breadcrumb: string[];
  mode: "add" | "edit";
  /** API collection endpoint, e.g. "/api/systmInfoMgr/systm_glssry". */
  apiPath: string;
  /** Record id (edit mode). */
  id?: string;
  /** Where to go after save/cancel (the list page). */
  basePath: string;
  /**
   * CI initForm endpoint (see lib/form-init): returns the fields, values, permissions and save
   * action, so the module passes no fields / defaultValues / toForm. Called as `initUrl?id=` in
   * edit mode.
   */
  initUrl?: string;
  /** Static field metadata for DynamicForm. */
  fields?: DynamicField[];
  /**
   * Hook form of `fields` for forms whose options depend on current values (CI changeDropdown
   * cascades): it is called on every render with the watched values and may use hooks
   * (e.g. useOptions). Pass either `fields` or `useFields`, not both.
   */
  useFields?: (values: TForm) => DynamicField[];
  /** CI $pvs_ObjNm: fields with an `attribute` follow its Form Settings "Visible in Form". */
  objectName?: string;
  /** Required unless `initUrl` is given. */
  defaultValues?: DefaultValues<TForm>;
  /** API record → form values (edit mode). */
  toForm?: (dto: TDto) => TForm;
  /** Form values → request body. Defaults to the values as-is. */
  toPayload?: (values: TForm) => unknown;
  /** Non-CRUD forms (e.g. profile, change password): explicit load/submit endpoints and method. */
  loadUrl?: string;
  submitUrl?: string;
  submitMethod?: "POST" | "PUT";
  /** Offer "Save and Add" in add mode (default true). */
  allowSaveAndAdd?: boolean;
  /** Also offer it on the edit form (CI formview_v): save, then open the add form (`addHref`, default `${basePath}/add`). */
  saveAndAddOnEdit?: boolean;
  addHref?: string;
  /**
   * Runs after a "Save and Add" save, before the form resets (add) or the add form opens (edit) — e.g. to upload a file
   * for the saved record. Return false to stop there.
   */
  onSavedAndAdd?: (data: unknown) => Promise<boolean | void> | boolean | void;
  /** More save buttons (CI "Save And Next"…): each saves, then calls its `after` with the response data. */
  extraSaves?: Array<{ key: string; label: string; icon?: LucideIcon; after: (data: unknown) => void }>;
  /** False: view only — no save buttons (a caller without the edit grant). */
  canSubmit?: boolean;
  /** Called with the response data after a successful save instead of navigating to basePath. */
  onSaved?: (data: unknown) => void;
  /**
   * Hook run on every render with the form (CI form scripts that fill fields on a change, e.g.
   * period_mst: picking a period type fills the dates). May use hooks.
   */
  useFormEffects?: (form: UseFormReturn<TForm>) => void;
  /** Extra content between the header card and the form (CI $data['buttons']). */
  children?: ReactNode;
  /**
   * A page-specific layout in place of the standard DynamicForm (e.g. the profile page). Loading,
   * saving, server-side field errors and navigation still happen here; it only draws the form.
   */
  renderForm?: (props: ResourceFormRenderProps<TForm>) => ReactNode;
}

/** What a `renderForm` layout receives: the same form, fields and actions DynamicForm gets. */
export interface ResourceFormRenderProps<TForm extends FieldValues> {
  form: UseFormReturn<TForm>;
  title: string;
  breadcrumb: string[];
  mode: "add" | "edit";
  fields: DynamicField[];
  submitting: boolean;
  onSubmit: (values: TForm) => void;
  onCancel: () => void;
}

function noFormEffects(): void {}

function withId(url: string, id?: string): string {
  return id ? `${url}${url.includes("?") ? "&" : "?"}id=${encodeURIComponent(id)}` : url;
}

/**
 * Standard CI formview_v on the shared DynamicForm: loads the record in edit mode, posts/puts the
 * values, maps server-side field errors (the API is the source of truth for validation) back onto
 * the form, and supports "Save and Add" like CI's `next` button.
 *
 * With `initUrl` the whole form is driven by the module's server-side initForm config: fields
 * (show/hide, read-only, options, dependent dropdowns, validation rules), values, permissions and
 * the save endpoint all come from that payload.
 */
export default function ResourceFormPage<TForm extends FieldValues, TDto = TForm>({
  title,
  breadcrumb,
  mode,
  apiPath,
  id,
  basePath,
  initUrl,
  fields,
  useFields,
  objectName,
  defaultValues,
  toForm,
  toPayload,
  loadUrl,
  submitUrl,
  submitMethod,
  allowSaveAndAdd = true,
  saveAndAddOnEdit = false,
  addHref,
  onSavedAndAdd,
  extraSaves = [],
  canSubmit: canSubmitProp,
  onSaved,
  useFormEffects = noFormEffects,
  children,
  renderForm,
}: ResourceFormPageProps<TForm, TDto>) {
  const router = useRouter();
  const form = useForm<TForm>({ defaultValues });
  useFormEffects(form);
  const [init, setInit] = useState<FormInitPayload | null>(null);
  const shouldLoad = !!initUrl || !!loadUrl || (mode === "edit" && !!id);
  const [loading, setLoading] = useState(shouldLoad);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Bumped by a form button / child-table change: the init payload is read again (status, buttons, totals).
  const [reloadKey, setReloadKey] = useState(0);
  // Last seen values of `fillFrom` fields; null until the loaded record is the baseline.
  const previousFill = useRef<Record<string, string> | null>(null);

  useEffect(() => {
    if (!shouldLoad) return;
    let cancelled = false;
    const url = initUrl ? withId(initUrl, mode === "edit" ? id : undefined) : (loadUrl ?? `${apiPath}/${id}`);
    authFetch(url, initUrl ? { cache: "no-store" } : undefined)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.success) throw new Error(json.message ?? "Failed to load record.");
        if (initUrl) {
          const payload = json.data as FormInitPayload;
          previousFill.current = null;
          setInit(payload);
          form.reset(payload.values as TForm);
        } else {
          form.reset(toForm ? toForm(json.data as TDto) : (json.data as TForm));
        }
      })
      .catch((e) => !cancelled && setLoadError(e instanceof Error ? e.message : "Failed to load record."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // `form`/`toForm` are stable for the lifetime of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldLoad, initUrl, loadUrl, id, apiPath, mode, reloadKey]);

  /** `kind`: "save", "add" (Save and Add) or the key of one of `extraSaves`. */
  const save = async (values: TForm, kind: string) => {
    const andAdd = kind === "add";
    setSubmitting(true);
    try {
      const target = init?.submit ?? {
        url: submitUrl ?? (mode === "edit" ? `${apiPath}/${id}` : apiPath),
        method: submitMethod ?? (mode === "edit" ? "PUT" : "POST"),
      };
      const res = await authFetch(target.url, {
        method: target.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload ? toPayload(values) : values),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        if (json.errors) {
          for (const [name, messages] of Object.entries(json.errors as Record<string, string[]>)) {
            if (name !== "_form") form.setError(name as Path<TForm>, { message: messages[0] });
          }
        }
        throw new Error(json.message ?? "Save failed.");
      }
      toast.success(json.data?.message ?? (mode === "edit" ? "Successfully updated record." : "Successfully added."));
      const extra = extraSaves.find((x) => x.key === kind);
      if (extra) extra.after(json.data);
      else if (andAdd) {
        if (onSavedAndAdd && (await onSavedAndAdd(json.data)) === false) return;
        if (mode === "edit") router.push(addHref ?? `${basePath}/add`);
        else form.reset((init?.defaults as DefaultValues<TForm> | undefined) ?? defaultValues);
      } else if (onSaved) onSaved(json.data);
      else router.push(basePath);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  };

  // Resolved before any early return so hook order stays stable across renders.
  const values = form.watch();
  const resolveFields = useFields ?? (() => init?.fields ?? fields ?? []);
  const configuredFields = resolveFields(values);

  // CI changeDropdown: options of `optionsUrl` fields are loaded for the current parent values.
  const optionUrls = configuredFields.map((f) => (f.optionsUrl ? fillUrlTemplate(f.optionsUrl, values) : null));
  const loadedOptions = useOptionsMap(optionUrls);
  // A changed parent clears the child's value, as CI's cascade did. Tracking starts once the
  // record is loaded, so loading it does not clear anything.
  const previousUrls = useRef<Record<string, string | null>>({});
  useEffect(() => {
    if (loading) return;
    configuredFields.forEach((f, i) => {
      if (!f.optionsUrl) return;
      const before = previousUrls.current[f.name];
      if (before !== undefined && before !== optionUrls[i]) form.setValue(f.name as Path<TForm>, "" as never);
      previousUrls.current[f.name] = optionUrls[i];
    });
  });

  // CI form scripts that fill inputs from a choice (DynamicField.fillFrom): only a change the user
  // makes after the record is loaded triggers it.
  useEffect(() => {
    if (loading) return;
    const sources = configuredFields.filter((f) => f.fillFrom);
    if (!sources.length) return;
    const now = Object.fromEntries(sources.map((f) => [f.name, String(values[f.name] ?? "")]));
    const before = previousFill.current;
    previousFill.current = now;
    if (!before) return;
    for (const f of sources) {
      if (before[f.name] === now[f.name] || !f.fillFrom) continue;
      const { url, map } = f.fillFrom;
      const setTargets = (data: Record<string, unknown> | null) => {
        for (const [target, key] of Object.entries(map)) {
          form.setValue(target as Path<TForm>, (data?.[key] ?? "") as never, { shouldDirty: true });
        }
      };
      const target = fillUrlTemplate(url, values);
      if (!target) {
        setTargets(null);
        continue;
      }
      authFetch(target, { cache: "no-store" })
        .then((res) => res.json())
        .then((json) => setTargets(json?.success ? (json.data as Record<string, unknown>) : null))
        .catch(() => setTargets(null));
    }
  });

  const { columns: formConfig } = useListColumns(objectName);
  // CI getVisibleColForFV: a field whose attribute is not visible in the form is not shown. Required
  // fields stay visible — hiding one would make every save fail validation.
  const resolvedFields = configuredFields.map((f, i) => {
    const cfg = f.attribute && formConfig?.size ? formConfig.get(f.attribute.toUpperCase()) : undefined;
    const hiddenBySettings = !!cfg && !cfg.visibleInForm && !f.required;
    const optionUrl = optionUrls[i];
    return {
      ...f,
      ...(f.optionsUrl ? { options: optionUrl ? (loadedOptions[optionUrl] ?? []) : [] } : {}),
      hidden: hiddenBySettings || !isFieldVisible(f, { values }),
    };
  });

  if (loading) return <p className="p-6 text-sm text-gray-400">Loading…</p>;
  if (loadError) return <p className="p-6 text-sm text-red-500">{loadError}</p>;

  const canSubmit = (canSubmitProp ?? true) && (init?.canSubmit ?? true);

  // After a form button: the response's redirect, else the button's `then` (default: read the form again).
  const afterButton = ({ button, redirect }: FormButtonResult) => {
    const next = redirect ?? button.then ?? "reload";
    if (next === "reload") setReloadKey((k) => k + 1);
    else router.push(next === "list" ? basePath : next);
  };
  const buttonBar = init?.buttons?.length ? <FormButtonBar buttons={init.buttons} onDone={afterButton} /> : null;
  const childTables = init?.tables?.length ? (
    <>
      {init.tables.map((t) => (
        <FormChildTable key={t.key} table={t} onChanged={() => setReloadKey((k) => k + 1)} />
      ))}
    </>
  ) : null;

  if (renderForm) {
    return renderForm({
      form,
      title: title ?? init?.title ?? "",
      breadcrumb,
      mode,
      fields: resolvedFields,
      submitting,
      onSubmit: (v) => save(v, "save"),
      onCancel: () => router.push(basePath),
    });
  }

  return (
    <div className="p-4">
      <DynamicForm
        form={form}
        title={title ?? init?.title ?? ""}
        mode={mode}
        breadcrumb={breadcrumb}
        fields={resolvedFields}
        submitting={submitting}
        canSubmit={canSubmit}
        onSubmit={(v) => save(v, "save")}
        onSaveAndAdd={allowSaveAndAdd && (mode === "add" || saveAndAddOnEdit) ? (v) => save(v, "add") : undefined}
        saveAndAddOnEdit={saveAndAddOnEdit}
        extraSubmits={extraSaves.map((x) => ({ key: x.key, label: x.label, icon: x.icon, onSubmit: (v: TForm) => save(v, x.key) }))}
        onCancel={() => router.push(basePath)}
        after={childTables}
      >
        {buttonBar}
        {children}
      </DynamicForm>
    </div>
  );
}
