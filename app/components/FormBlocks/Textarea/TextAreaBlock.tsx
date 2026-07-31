"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FieldErrors,
  FieldValues,
  Path,
  RegisterOptions,
  UseFormRegister,
} from "react-hook-form";

interface TextareaBlockProps<T extends FieldValues>
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  name: Path<T>;
  register: UseFormRegister<T>;
  required?: boolean;
  rules?: RegisterOptions<T, Path<T>>;
  errors?: FieldErrors<T>;
}

export function TextareaBlock<T extends FieldValues>({
  label,
  name,
  register,
  required = false,
  rules,
  errors,
  ...props
}: TextareaBlockProps<T>) {
  const errorMessage = errors?.[name]?.message as string | undefined;

  return (
    <div className="flex gap-2 items-center">
      {/* Label */}
      <div className="w-1/4 space-y-0 text-end">
        <Label htmlFor={name}>
          {label}
          {required && <span className="text-red-500"> *</span>}
        </Label>
      </div>

      {/* Textarea */}
      <div className="w-3/4 space-y-0">
        <Textarea
          id={name}
          {...props}
          {...register(name, {
            ...(required && { required: `${label} is required` }),
            ...rules,
          })}
        />

        {/* Error */}
        {errorMessage && (
          <p className="text-red-500 text-sm">{errorMessage}</p>
        )}
      </div>
    </div>
  );
}
