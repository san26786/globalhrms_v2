"use client";

import React from "react";
import { Controller, type Control, type ControllerProps, type FieldValues } from "react-hook-form";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

import DynamicFieldWrapper from "@/components/DynamicForm/DynamicFieldWrapper";

interface SelectBlockProps {
  label: string;
  name: string;
  control: Control<FieldValues>;
  /** Values may be ids (numbers); Radix Select works on strings, so they are stringified here. */
  options: { label: string; value: string | number }[];
  placeholder?: string;
  /** react-hook-form rules (toRegisterRules), as Controller accepts them. */
  rules?: ControllerProps<FieldValues>["rules"];
  error?: string;
  /** Read-only field: the value is shown but cannot be changed. */
  disabled?: boolean;
}

export function SelectField({
  label,
  name,
  control,
  options,
  placeholder = "Select an option",
  rules = {},
  error,
  disabled = false,
}: SelectBlockProps) {
  return (
    <DynamicFieldWrapper
      label={label}
      required={!!rules.required}
      htmlFor={name}
      error={error}
    >
      <Controller
        name={name}
        control={control}
        rules={rules}
        render={({ field }) => (
          <Select
            onValueChange={field.onChange}
            disabled={disabled}
            value={field.value === undefined || field.value === null ? "" : String(field.value)}
          >
            <SelectTrigger
              id={name}
              className="h-9 px-3 rounded-lg border border-gray-300"
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {options.map((option) => (
                <SelectItem
                  key={String(option.value)}
                  value={String(option.value)}
                  className="py-2"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </DynamicFieldWrapper>
  );
}
