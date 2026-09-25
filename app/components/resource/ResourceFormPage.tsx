"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type DefaultValues, type FieldValues, type Path } from "react-hook-form";
import { toast } from "sonner";

import DynamicForm from "@/components/DynamicForm/DynamicForm";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import { authFetch } from "@/lib/auth/authFetch";

interface ResourceFormPageProps<TForm extends FieldValues, TDto> {
  title: string;
  breadcrumb: string[];
  mode: "add" | "edit";
  /** API collection endpoint, e.g. "/api/systmInfoMgr/systm_glssry". */
  apiPath: string;
  /** Record id (edit mode). */
  id?: string;
  /** Where to go after save/cancel (the list page). */
  basePath: string;
  /** Static field metadata for DynamicForm. */
  fields?: DynamicField[];
  /**
   * Hook form of `fields` for forms whose options depend on current values (CI changeDropdown
   * cascades): it is called on every render with the watched values and may use hooks
   * (e.g. useOptions). Pass either `fields` or `useFields`, not both.
   */
  useFields?: (values: TForm) => DynamicField[];
  defaultValues: DefaultValues<TForm>;
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
  /** Called with the response data after a successful save instead of navigating to basePath. */
  onSaved?: (data: unknown) => void;
}

/**
 * Standard CI formview_v on the shared DynamicForm: loads the record in edit mode, posts/puts the
 * values, maps server-side field errors (the API is the source of truth for validation) back onto
 * the form, and supports "Save and Add" like CI's `next` button.
 */
export default function ResourceFormPage<TForm extends FieldValues, TDto = TForm>({
  title,
  breadcrumb,
  mode,
  apiPath,
  id,
  basePath,
  fields,
  useFields,
  defaultValues,
  toForm,
  toPayload,
  loadUrl,
  submitUrl,
  submitMethod,
  allowSaveAndAdd = true,
  onSaved,
}: ResourceFormPageProps<TForm, TDto>) {
  const router = useRouter();
  const form = useForm<TForm>({ defaultValues });
  const shouldLoad = !!loadUrl || (mode === "edit" && !!id);
  const [loading, setLoading] = useState(shouldLoad);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!shouldLoad) return;
    let cancelled = false;
    authFetch(loadUrl ?? `${apiPath}/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.success) throw new Error(json.message ?? "Failed to load record.");
        form.reset(toForm ? toForm(json.data as TDto) : (json.data as TForm));
      })
      .catch((e) => !cancelled && setLoadError(e instanceof Error ? e.message : "Failed to load record."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // `form`/`toForm` are stable for the lifetime of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldLoad, loadUrl, id, apiPath]);

  const save = async (values: TForm, andAdd: boolean) => {
    setSubmitting(true);
    try {
      const res = await authFetch(submitUrl ?? (mode === "edit" ? `${apiPath}/${id}` : apiPath), {
        method: submitMethod ?? (mode === "edit" ? "PUT" : "POST"),
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
      if (andAdd) form.reset(defaultValues);
      else if (onSaved) onSaved(json.data);
      else router.push(basePath);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  };

  // Resolved before any early return so hook order stays stable across renders.
  const values = form.watch();
  const resolveFields = useFields ?? (() => fields ?? []);
  const resolvedFields = resolveFields(values);

  if (loading) return <p className="p-6 text-sm text-gray-400">Loading…</p>;
  if (loadError) return <p className="p-6 text-sm text-red-500">{loadError}</p>;

  return (
    <div className="p-4">
      <DynamicForm
        form={form}
        title={title}
        mode={mode}
        breadcrumb={breadcrumb}
        fields={resolvedFields}
        submitting={submitting}
        onSubmit={(v) => save(v, false)}
        onSaveAndAdd={mode === "add" && allowSaveAndAdd ? (v) => save(v, true) : undefined}
        onCancel={() => router.push(basePath)}
      />
    </div>
  );
}
