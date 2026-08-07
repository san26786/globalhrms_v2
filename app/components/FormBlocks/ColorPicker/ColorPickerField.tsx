"use client";

import React, { useState } from "react";
import { Control, Controller, FieldError } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import DynamicFieldWrapper from "@/components/DynamicForm/DynamicFieldWrapper";

/**
 * Consolidated color picker.
 * Previously this existed as three near-identical components
 * (SimpleColorPicker, AdvancedColorPicker, ColorPickerField) that only
 * differed in whether they showed a hex text input and/or a preset
 * swatch popover. That's now a single `variant` prop.
 */

const PRESET_COLORS = [
  "#FF0000", "#FF4500", "#FFA500", "#FFD700", "#FFFF00", "#ADFF2F",
  "#00FF00", "#00CED1", "#0000FF", "#8A2BE2", "#FF1493", "#FF69B4",
  "#000000", "#808080", "#C0C0C0", "#FFFFFF", "#8B4513", "#2F4F4F",
  "#DC143C", "#FF6347", "#32CD32", "#1E90FF", "#9932CC", "#FF8C00",
];

interface ColorPickerFieldProps {
  label: string;
  name: string;
  control: Control<any>;
  required?: boolean;
  error?: string | FieldError;
  defaultValue?: string;
  className?: string;
  disabled?: boolean;
  /** "simple" = native color input only. "advanced" = popover + hex input + presets. */
  variant?: "simple" | "advanced";
  showPresets?: boolean;
}

export function ColorPickerField({
  label,
  name,
  control,
  required = false,
  error,
  defaultValue = "#000000",
  className = "",
  disabled = false,
  variant = "simple",
  showPresets = true,
}: ColorPickerFieldProps) {
  const [isOpen, setIsOpen] = useState(false);

  const rules = {
    required: required ? `${label} is required` : false,
    pattern: {
      value: /^#[0-9A-Fa-f]{6}$/,
      message: "Please enter a valid hex color code",
    },
  };

  return (
    <DynamicFieldWrapper
      label={label}
      required={required}
      htmlFor={name}
      error={error}
      className={className}
    >
      <Controller
        name={name}
        control={control}
        defaultValue={defaultValue}
        rules={rules}
        render={({ field }) =>
          variant === "advanced" ? (
            <div className="flex items-center space-x-3">
              <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-12 h-10 p-0 border-2"
                    style={{ backgroundColor: field.value || defaultValue }}
                    disabled={disabled}
                  >
                    <span className="sr-only">Pick color</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-4" align="start">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Input
                        type="color"
                        value={field.value || defaultValue}
                        onChange={(e) => field.onChange(e.target.value)}
                        className="w-16 h-10 p-1 cursor-pointer"
                        disabled={disabled}
                      />
                      <Input
                        value={field.value || defaultValue}
                        onChange={(e) => field.onChange(e.target.value)}
                        placeholder="#000000"
                        className="flex-1 font-mono text-sm"
                        disabled={disabled}
                        maxLength={7}
                      />
                    </div>

                    {showPresets && (
                      <div>
                        <Label className="text-xs font-medium text-gray-600 mb-2 block">
                          Preset Colors
                        </Label>
                        <div className="grid grid-cols-6 gap-2">
                          {PRESET_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              className="w-8 h-8 rounded border-2 border-gray-200 hover:border-gray-400 transition-colors"
                              style={{ backgroundColor: color }}
                              onClick={() => {
                                field.onChange(color);
                                setIsOpen(false);
                              }}
                              disabled={disabled}
                              title={color}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              <Input
                value={field.value || defaultValue}
                onChange={(e) => field.onChange(e.target.value)}
                placeholder="#000000"
                className="flex-1 font-mono text-sm"
                disabled={disabled}
                maxLength={7}
              />
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <div
                className="w-12 h-10 rounded border-2 border-gray-300 shadow-sm"
                style={{ backgroundColor: field.value || defaultValue }}
              />
              <Input
                id={name}
                type="color"
                disabled={disabled}
                className="w-16 h-10 p-1 rounded cursor-pointer"
                value={field.value || defaultValue}
                onChange={(e) => field.onChange(e.target.value)}
              />
              <span className="text-sm text-gray-600 font-mono">
                {field.value || defaultValue}
              </span>
            </div>
          )
        }
      />
    </DynamicFieldWrapper>
  );
}

export default ColorPickerField;
