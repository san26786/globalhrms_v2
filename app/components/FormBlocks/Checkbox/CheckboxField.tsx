"use client";

import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Controller, FieldError } from "react-hook-form";

import DynamicFieldWrapper from "@/components/DynamicForm/DynamicFieldWrapper";

interface CheckboxBlockProps {
  label: string;
  name: string;
  control: any;
  required?: boolean;
  error?: string | FieldError;
}

export function CheckboxField({
  label,
  name,
  control,
  required = false,
  error,
}: CheckboxBlockProps) {
  return (
    <DynamicFieldWrapper
      label={label}
      required={required}
      htmlFor={name}
      error={error}
    >
      <Controller
        name={name}
        control={control}
        defaultValue={false}
        rules={required ? { required: `${label} is required` } : {}}
        render={({ field }) => (
          <Checkbox
            id={name}
            checked={!!field.value}
            onCheckedChange={field.onChange}
          />
        )}
      />
    </DynamicFieldWrapper>
  );
}
