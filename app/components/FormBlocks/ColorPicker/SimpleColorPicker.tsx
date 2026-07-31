"use client";

import React from "react";
import { Control, Controller, FieldError } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface SimpleColorPickerProps {
  label: string;
  name: string;
  control: Control<any>;
  required?: boolean;
  error?: string | FieldError;
  defaultValue?: string;
  className?: string;
  disabled?: boolean;
}

export const SimpleColorPicker: React.FC<SimpleColorPickerProps> = ({
  label,
  name,
  control,
  required = false,
  error,
  defaultValue = "#000000",
  className = "",
  disabled = false,
}) => {
  const errorMessage = typeof error === "string" ? error : error?.message;

  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={name} className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      
      <Controller
        name={name}
        control={control}
        defaultValue={defaultValue}
        rules={{
          required: required ? `${label} is required` : false,
        }}
        render={({ field }) => (
          <div className="flex items-center space-x-2">
            <Input
              {...field}
              id={name}
              type="color"
              disabled={disabled}
              className="w-20 h-10 p-1 rounded cursor-pointer border"
              onChange={(e) => field.onChange(e.target.value)}
            />
            <span className="text-sm text-gray-600 font-mono">
              {field.value || defaultValue}
            </span>
          </div>
        )}
      />
      
      {errorMessage && (
        <p className="text-sm text-red-500 mt-1">{errorMessage}</p>
      )}
    </div>
  );
};

export default SimpleColorPicker;
