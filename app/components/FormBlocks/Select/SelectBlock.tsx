"use client";

import React from "react";
import { Controller } from "react-hook-form";
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
  control: any;
  options: { label: string; value: string }[];
  placeholder?: string;
  rules?: {
    required?: string | boolean;
    [key: string]: any; // Allow other possible validation rules
  };
  error?: string;
}

export function SelectField({
  label,
  name,
  control,
  options,
  placeholder = "Select an option",
  rules = {},
  error,
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
            value={field.value || ""}
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
                  key={option.value}
                  value={option.value}
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
