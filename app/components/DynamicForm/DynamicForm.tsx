"use client";

import React, { useState } from "react";
import { UseFormReturn, FieldValues } from "react-hook-form";
import { ChevronRight, Database, Plus, X, Save } from "lucide-react";

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
  /** Breadcrumb trail shown above the title, e.g. ["User", "User Master"]. The Add/Edit crumb is appended. */
  breadcrumb?: string[];
  /** Disables the save buttons while a request is in flight. */
  submitting?: boolean;
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
  breadcrumb = ["Bank Manager", "Bank Account Details"],
  submitting = false,
}: DynamicFormProps<T>) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = form;

  const [submitType, setSubmitType] = useState<"save" | "saveAndAdd">("save");

  const handleFormSubmit = (data: T) => {
    if (submitType === "saveAndAdd" && onSaveAndAdd) {
      onSaveAndAdd(data);
    } else {
      onSubmit(data);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Card (Matches BreadcrumbHeader Design) */}
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              {breadcrumb.map((crumb) => (
                <React.Fragment key={crumb}>
                  <span>{crumb}</span>
                  <ChevronRight size={15} className="text-slate-400" />
                </React.Fragment>
              ))}
              <span className="font-semibold text-blue-600">
                {mode === "add" ? "Add" : "Edit"}
              </span>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <Database className="text-blue-600 h-6 w-6" />
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-800 animate-in fade-in slide-in-from-left-2 duration-200">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Header Save Button */}
            <Button
              type="submit"
              form="dynamic-form"
              disabled={submitting}
              onClick={() => setSubmitType("save")}
              size="icon"
              className="rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200/50 hover:shadow-blue-300/60 hover:scale-105 active:scale-95 transition-all duration-200"
              title="Save"
            >
              <Save className="h-5 w-5 stroke-[2.5]" />
            </Button>

            {/* Header Save & Add Button */}
            {mode === "add" && onSaveAndAdd && (
              <Button
                type="submit"
                form="dynamic-form"
                onClick={() => setSubmitType("saveAndAdd")}
                size="icon"
                className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200/50 hover:shadow-emerald-300/60 hover:scale-105 active:scale-95 transition-all duration-200"
                title="Save and Add"
              >
                <Plus className="h-5 w-5 stroke-[2.5]" />
              </Button>
            )}

            {/* Header Cancel Button */}
            {onCancel && (
              <Button
                type="button"
                onClick={onCancel}
                variant="outline"
                size="icon"
                className="rounded-full border-slate-200 hover:bg-slate-50 text-slate-600 shadow-sm hover:scale-105 active:scale-95 transition-all duration-200"
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
        onSubmit={handleSubmit(handleFormSubmit)}
        className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6"
      >
        <FormRenderer
          fields={fields}
          register={register as any}
          control={control as any}
          errors={errors as any}
        />

        {/* Footer Actions (Matching modern blue and success themes) */}
        <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
          <Button
            type="submit"
            form="dynamic-form"
            disabled={submitting}
            onClick={() => setSubmitType("save")}
            className="rounded-full !bg-none !bg-blue-600 hover:!bg-blue-700 text-white px-6 h-10 text-sm font-semibold shadow-md shadow-blue-200/50 hover:shadow-blue-300/60 transition-all duration-200 active:scale-95 border-0"
          >
            {submitText ?? (mode === "add" ? "Save" : "Update")}
          </Button>

          {mode === "add" && onSaveAndAdd && (
            <Button
              type="submit"
              form="dynamic-form"
              onClick={() => setSubmitType("saveAndAdd")}
              className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-6 h-10 text-sm font-semibold shadow-md shadow-emerald-200/50 hover:shadow-emerald-300/60 transition-all duration-200 active:scale-95 border-0"
            >
              Save And Add
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="rounded-full border-slate-200 text-slate-700 hover:bg-slate-50 px-6 h-10 text-sm font-semibold shadow-sm hover:scale-105 active:scale-95 transition-all duration-200"
          >
            {cancelText}
          </Button>
        </div>
      </form>
    </div>
  );
}