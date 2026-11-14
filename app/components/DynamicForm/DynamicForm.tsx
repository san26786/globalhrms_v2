"use client";

import React, { useState } from "react";
import { UseFormReturn, FieldValues } from "react-hook-form";
import { ChevronRight, ChevronsRight, Database, Plus, X, Save, type LucideIcon } from "lucide-react";

import FormRenderer from "./FormRenderer";
import { Button } from "@/components/ui/button";

interface DynamicFormProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  fields: any[];
  title: string;
  mode?: "add" | "edit";
  onSubmit: (data: T) => void;
  onSaveAndAdd?: (data: T) => void;
  submitText?: string;
  cancelText?: string;
  onCancel?: () => void;
  children?: React.ReactNode;
  /** Content under the form card (CI formview_v child table, e.g. a timesheet's items). */
  after?: React.ReactNode;
  /** Breadcrumb trail shown above the title, e.g. ["User", "User Master"]. The Add/Edit crumb is appended. */
  breadcrumb?: string[];
  /** Disables the save buttons while a request is in flight. */
  submitting?: boolean;
  /** False for a view-only form (no modify permission): the save buttons are not shown. */
  canSubmit?: boolean;
  /** CI formview_v also offered "Save And Add" on the edit form (it saved, then opened a new form). */
  saveAndAddOnEdit?: boolean;
  /** More save buttons (CI formview_v submit buttons such as "Save And Next"): each saves, then runs its own step. */
  extraSubmits?: Array<{ key: string; label: string; icon?: LucideIcon; onSubmit: (data: T) => void }>;
}

export default function DynamicForm<T extends FieldValues>({
  form,
  fields,
  title,
  mode = "add",
  onSubmit,
  onSaveAndAdd,
  submitText,
  cancelText = "Cancel",
  onCancel,
  children,
  after,
  breadcrumb = ["Bank Manager", "Bank Account Details"],
  submitting = false,
  canSubmit = true,
  saveAndAddOnEdit = false,
  extraSubmits = [],
}: DynamicFormProps<T>) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = form;

  const [submitType, setSubmitType] = useState<string>("save");
  const showSaveAndAdd = canSubmit && !!onSaveAndAdd && (mode === "add" || saveAndAddOnEdit);

  const handleFormSubmit = (data: T) => {
    const extra = extraSubmits.find((x) => x.key === submitType);
    if (extra) {
      extra.onSubmit(data);
    } else if (submitType === "saveAndAdd" && onSaveAndAdd) {
      onSaveAndAdd(data);
    } else {
      onSubmit(data);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Card (Matches BreadcrumbHeader Design) */}
      <div className="rounded-3xl border bg-white p-6 shadow-sm brand:relative brand:border-slate-200 brand:shadow-[0_1px_2px_rgba(16,24,40,0.04)] brand:before:absolute brand:before:inset-x-8 brand:before:top-0 brand:before:h-1 brand:before:rounded-b-full brand:before:bg-gradient-to-r brand:before:from-[#e15425] brand:before:to-[#0b5394] dark:border-white/10 dark:bg-[#111a2e]">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-[13px] text-gray-500 brand:text-[#535768] dark:text-[#aab3c5]">
              {breadcrumb.map((crumb) => (
                <React.Fragment key={crumb}>
                  <span>{crumb}</span>
                  <ChevronRight size={15} className="text-slate-400 dark:text-[#8b95ab]" />
                </React.Fragment>
              ))}
              <span className="font-semibold text-blue-600 brand:text-[#0b5394] dark:text-[#8cb8f0]">
                {mode === "add" ? "Add" : "Edit"}
              </span>
            </div>

            <div className="mt-2 flex items-center gap-2 brand:mt-3 brand:gap-3">
              <Database className="text-blue-600 h-6 w-6 brand:h-9 brand:w-9 brand:shrink-0 brand:rounded-xl brand:bg-[#fbe6dd] brand:p-2 brand:text-[#b4441f] dark:bg-[#da5427]/15 dark:text-[#f8a27e]" />
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-800 brand:font-semibold brand:text-[22px] brand:leading-tight brand:tracking-[-0.02em] brand:text-[#1a1818] brand:md:text-[24px] dark:text-[#f1f3f8] animate-in fade-in slide-in-from-left-2 duration-200">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Header Save Button */}
            {canSubmit && (
              <Button
                type="submit"
                form="dynamic-form"
                disabled={submitting}
                onClick={() => setSubmitType("save")}
                size="icon"
                className="rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200/50 hover:shadow-blue-300/60 brand:bg-[#e15425] brand:hover:bg-[#c2431c] brand:shadow-[#e15425]/25 dark:shadow-black/30 hover:scale-105 active:scale-95 transition-all duration-200"
                title="Save"
              >
                <Save className="h-5 w-5 stroke-[2.5]" />
              </Button>
            )}

            {/* Header Save & Add Button */}
            {showSaveAndAdd && (
              <Button
                type="submit"
                form="dynamic-form"
                onClick={() => setSubmitType("saveAndAdd")}
                size="icon"
                className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200/50 hover:shadow-emerald-300/60 brand:bg-[#0b5394] brand:hover:bg-[#094679] brand:shadow-[#0b5394]/25 dark:shadow-black/30 hover:scale-105 active:scale-95 transition-all duration-200"
                title="Save and Add"
              >
                <Plus className="h-5 w-5 stroke-[2.5]" />
              </Button>
            )}

            {canSubmit &&
              extraSubmits.map((x) => {
                const Icon = x.icon ?? ChevronsRight;
                return (
                  <Button
                    key={x.key}
                    type="submit"
                    form="dynamic-form"
                    disabled={submitting}
                    onClick={() => setSubmitType(x.key)}
                    size="icon"
                    className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md brand:bg-[#0b5394] brand:hover:bg-[#094679] dark:shadow-black/30 hover:scale-105 active:scale-95 transition-all duration-200"
                    title={x.label}
                    aria-label={x.label}
                  >
                    <Icon className="h-5 w-5 stroke-[2.5]" />
                  </Button>
                );
              })}

            {/* Header Cancel Button */}
            {onCancel && (
              <Button
                type="button"
                onClick={onCancel}
                variant="outline"
                size="icon"
                className="rounded-full border-slate-200 hover:bg-slate-50 text-slate-600 brand:hover:bg-[#f6f7f9] brand:text-[#323338] dark:border-white/10 dark:bg-transparent dark:hover:bg-white/5 dark:text-[#d5dae4] shadow-sm hover:scale-105 active:scale-95 transition-all duration-200"
                title="Cancel"
              >
                <X className="h-5 w-5 stroke-[2.5]" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {children}

      {/* Main Form Body */}
      <form
        id="dynamic-form"
        onSubmit={canSubmit ? handleSubmit(handleFormSubmit) : (e) => e.preventDefault()}
        className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6 brand:shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-white/10 dark:bg-[#111a2e]"
      >
        <FormRenderer
          fields={fields}
          register={register as any}
          control={control as any}
          errors={errors as any}
        />

        {/* Footer Actions (Matching modern blue and success themes) */}
        <div className="flex items-center gap-2 pt-4 border-t border-slate-100 dark:border-white/10">
          {canSubmit && (
            <Button
              type="submit"
              form="dynamic-form"
              disabled={submitting}
              onClick={() => setSubmitType("save")}
              className="rounded-full !bg-none !bg-blue-600 hover:!bg-blue-700 brand:!bg-[#e15425] brand:hover:!bg-[#c2431c] text-white px-6 h-10 text-sm font-semibold shadow-md shadow-blue-200/50 hover:shadow-blue-300/60 brand:shadow-[#e15425]/25 dark:shadow-black/30 transition-all duration-200 active:scale-95 border-0"
            >
              {submitText ?? (mode === "add" ? "Save" : "Update")}
            </Button>
          )}

          {showSaveAndAdd && (
            <Button
              type="submit"
              form="dynamic-form"
              onClick={() => setSubmitType("saveAndAdd")}
              className="rounded-full bg-emerald-600 hover:bg-emerald-700 brand:bg-[#0b5394] brand:hover:bg-[#094679] text-white px-6 h-10 text-sm font-semibold shadow-md shadow-emerald-200/50 hover:shadow-emerald-300/60 brand:shadow-[#0b5394]/25 dark:shadow-black/30 transition-all duration-200 active:scale-95 border-0"
            >
              Save And Add
            </Button>
          )}

          {canSubmit &&
            extraSubmits.map((x) => (
              <Button
                key={x.key}
                type="submit"
                form="dynamic-form"
                disabled={submitting}
                onClick={() => setSubmitType(x.key)}
                className="rounded-full bg-emerald-600 hover:bg-emerald-700 brand:bg-[#0b5394] brand:hover:bg-[#094679] text-white px-6 h-10 text-sm font-semibold shadow-md dark:shadow-black/30 transition-all duration-200 active:scale-95 border-0"
              >
                {x.label}
              </Button>
            ))}

          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="rounded-full border-slate-200 text-slate-700 hover:bg-slate-50 brand:text-[#323338] brand:hover:bg-[#f6f7f9] dark:border-white/10 dark:bg-transparent dark:text-[#d5dae4] dark:hover:bg-white/5 px-6 h-10 text-sm font-semibold shadow-sm hover:scale-105 active:scale-95 transition-all duration-200"
          >
            {cancelText}
          </Button>
        </div>
      </form>

      {after}
    </div>
  );
}