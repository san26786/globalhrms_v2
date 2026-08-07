"use client";

import React from "react";
import { Textarea } from "@/components/ui/textarea";
import {
  FieldErrors,
  FieldValues,
  Path,
  RegisterOptions,
  UseFormRegister,
} from "react-hook-form";

import DynamicFieldWrapper from "@/components/DynamicForm/DynamicFieldWrapper";

interface TextareaBlockProps<T extends FieldValues>
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  name: Path<T>;
  register: UseFormRegister<T>;
  required?: boolean;
  rules?: RegisterOptions<T, Path<T>>;
  errors?: FieldErrors<T>;
}

export function TextareaField<T extends FieldValues>({
  label,
  name,
  register,
  required = false,
  rules,
  errors,
  ...props
}: TextareaBlockProps<T>) {
  return (
    <DynamicFieldWrapper
      label={label}
      required={required}
      htmlFor={name}
      error={errors?.[name]?.message as string | undefined}
    >
      <Textarea
        id={name}
        {...props}
        {...register(name, {
          ...(required && { required: `${label} is required` }),
          ...rules,
        })}
      />
    </DynamicFieldWrapper>
  );
}
