"use client";

import React from "react";
import { Control, Controller, FieldError } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface ColorPickerBlockProps {
  label: string;
  name: string;
  control: Control<any>;
  required?: boolean;
  error?: string | FieldError;
  defaultValue?: string;
  className?: string;
  disabled?: boolean;
}

export const ColorPickerBlock: React.FC<ColorPickerBlockProps> = ({
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
    <div className='flex gap-2 items-center'>
<div className="w-1/4 space-y-0 text-end">
      <Label htmlFor={name} className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      </div>
<div className="w-3/4 space-y-0">
      <Controller
        name={name}
        control={control}
        defaultValue={defaultValue}
        rules={{
          required: required ? `${label} is required` : false,
          pattern: {
            value: /^#[0-9A-Fa-f]{6}$/,
            message: "Please enter a valid hex color code (e.g., #FF0000)",
          },
        }}
        render={({ field }) => (
          <div className="flex items-center space-x-3">
            {/* Color Preview */}
            <div
              className="w-12 h-10 rounded border-2 border-gray-300 shadow-sm"
              style={{ backgroundColor: field.value || defaultValue }}
            />
            
            {/* Color Input */}
            <Input
              {...field}
              id={name}
              type="color"
              disabled={disabled}
              className="w-16 h-10 p-1 rounded cursor-pointer"
              onChange={(e) => field.onChange(e.target.value)}
            />
            
          </div>
        )}
      />
      
      {errorMessage && (
        <p className="text-sm text-red-500 mt-1">{errorMessage}</p>
      )}
    </div>
  </div>
  );
};

export default ColorPickerBlock;
