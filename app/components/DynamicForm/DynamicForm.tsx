"use client";

import React from "react";
import { UseFormReturn, FieldValues } from "react-hook-form";

import FormRenderer from "./FormRenderer";

import { Button } from "@/components/ui/button";

interface DynamicFormProps<T extends FieldValues> {
  form: UseFormReturn<T>;

  fields: any[];

  title: string;

  mode?: "add" | "edit";

  onSubmit: (data: T) => void;

  submitText?: string;

  cancelText?: string;

  onCancel?: () => void;

  children?: React.ReactNode;
}

export default function DynamicForm<T extends FieldValues>({
  form,
  fields,
  title,
  mode = "add",
  onSubmit,
  submitText,
  cancelText = "Cancel",
  onCancel,
  children,
}: DynamicFormProps<T>) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = form;

  return (
    <div className="space-y-6">

      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
      </div>

      {/* Tabs / Breadcrumb later */}
      {children}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
      >
        <FormRenderer
          fields={fields}
          register={register}
          control={control}
          errors={errors}
        />

        <div className="flex gap-3 pt-4">
          <Button type="submit">
            {submitText ??
              (mode === "add" ? "Save" : "Update")}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            {cancelText}
          </Button>
        </div>
      </form>
    </div>
  );
}