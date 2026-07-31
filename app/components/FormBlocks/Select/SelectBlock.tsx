"use client";

import React from "react";
import { Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

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

export function SelectBlock({
  label,
  name,
  control,
  options,
  placeholder = "Select an option",
  rules = {},
  error,
}: SelectBlockProps) {
  return (
    <div className="flex gap-2 items-center">
      <div className="w-1/4 space-y-0 text-end">
        <Label htmlFor={name}>
          {label}
          {rules.required && <span className="text-red-500"> *</span>}
        </Label>
      </div>
      <div className="w-3/4 space-y-0">
        <Controller
          name={name}
          control={control}
          rules={rules}
          render={({ field }) => (
            <Select onValueChange={field.onChange} 
              // defaultValue={field.value}
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
        {error && <p className="text-red-500 text-sm pt-1">{error}</p>}
      </div>
    </div>
  );
}
