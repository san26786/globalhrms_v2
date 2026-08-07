"use client";

import React, { ReactNode } from "react";
import { FieldError } from "react-hook-form";

/**
 * Single shared helper for pulling a display string out of either
 * a plain string error or a react-hook-form FieldError.
 * Was previously copy-pasted in 4 different field components.
 */
export function getErrorMessage(
  error?: FieldError | string
): string | undefined {
  if (!error) return undefined;
  return typeof error === "string" ? error : error.message;
}

export interface DynamicFieldWrapperProps {
  label?: string;
  required?: boolean;
  description?: string;
  tooltip?: string;
  error?: FieldError | string;
  hidden?: boolean;
  className?: string;
  htmlFor?: string;
  children: ReactNode;
}

/**
 * Shared label/required-marker/description/error layout used by every
 * field block (Input, Textarea, Select, Checkbox, DatePicker, ColorPicker).
 * Centralizing this removes the near-identical "w-1/4 label + w-3/4
 * control" markup that used to be duplicated in each field file.
 */
export default function DynamicFieldWrapper({
  label,
  required = false,
  description,
  tooltip,
  error,
  hidden = false,
  className = "",
  htmlFor,
  children,
}: DynamicFieldWrapperProps) {
  if (hidden) return null;

  const errorMessage = getErrorMessage(error);

  return (
    <div className={`flex gap-2 items-center ${className}`}>
      {label && (
        <div className="w-1/4 space-y-0 text-end">
          <label
            htmlFor={htmlFor}
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-700"
          >
            <span>{label}</span>

            {required && <span className="text-red-500">*</span>}

            {tooltip && (
              <span title={tooltip} className="cursor-help text-xs text-gray-400">
                ⓘ
              </span>
            )}
          </label>
        </div>
      )}

      <div className="w-3/4 space-y-0">
        {children}

        {description && !errorMessage && (
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        )}

        {errorMessage && (
          <p className="text-sm text-red-500 mt-1">{errorMessage}</p>
        )}
      </div>
    </div>
  );
}
