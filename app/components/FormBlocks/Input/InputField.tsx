"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { type DynamicField } from "@/lib/form-builder/formTypes";
import {
  FieldErrors,
  FieldValues,
  RegisterOptions,
  UseFormRegister,
  Path,
} from "react-hook-form";
import { Upload } from "lucide-react";

import DynamicFieldWrapper from "@/components/DynamicForm/DynamicFieldWrapper";

interface InputFieldProps<TFieldValues extends FieldValues> {
  /** Generic Form Builder support */
  field?: DynamicField;

  /** Existing props (kept for backward compatibility) */
  label?: string;
  name?: Path<TFieldValues>;

  register: UseFormRegister<TFieldValues>;
  rules?: RegisterOptions<TFieldValues, Path<TFieldValues>>;
  errors?: FieldErrors<TFieldValues>;

  /** input config */
  type?: string;
  readOnly?: boolean;
  required?: boolean;
  accept?: string;
  placeholder?: string;
  value?: string | number;

  /** file handling */
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  previewUrl?: string;

  /** UI extras */
  leadingAddon?: string;
  desc?: string;
  addnewInputfile?: string;
  onAddNewInput?: () => void;
}

export function InputField<
  TFieldValues extends FieldValues = FieldValues
>({
  field,
  label,
  name,
  register,
  rules,
  errors,
  type = "text",
  readOnly = false,
  required = false,
  accept,
  placeholder,
  value,
  onChange,
  previewUrl,
  leadingAddon,
  desc,
  addnewInputfile,
  onAddNewInput,
}: InputFieldProps<TFieldValues>) {

  const fieldLabel = field?.label ?? label ?? "";
  const fieldName = (field?.name ?? name) as Path<TFieldValues>;
  const fieldType = field?.type ?? type;
  const fieldReadOnly = field?.readOnly ?? readOnly;
  const fieldRequired = field?.required ?? required;
  const fieldPlaceholder = field?.placeholder ?? placeholder;

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = React.useState<string>("");

  const fileRegister = register(fieldName, {
    ...(fieldRequired && { required: `${fieldLabel} is required` }),
    ...rules,
  });

  return (
    <DynamicFieldWrapper
      label={fieldLabel}
      required={fieldRequired}
      htmlFor={fieldName}
      error={errors?.[fieldName]?.message as string | undefined}
    >
      <div className="flex">
        {leadingAddon && (
          <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 bg-gray-100 text-gray-600 text-sm">
            {leadingAddon}
          </span>
        )}

        {type === "file" ? (
          <div className="flex items-center gap-3">
            {/* Hidden file input */}
            <input
                ref={(el) => {
                  fileInputRef.current = el;
                  fileRegister.ref(el);
                }}
                id={fieldName}
                type={fieldType}
                accept={accept}
                className="hidden"
                name={fieldName}
                onBlur={fileRegister.onBlur}
                onChange={(e) => {
                  fileRegister.onChange(e);

                  setFileName(e.target.files?.[0]?.name || "");

                  onChange?.(e);
                }}
            />

            {/* Browse Button */}
            <Button
              type="button"
              variant="primary"
              className="flex gap-2 items-center p-4"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload /> Browse
            </Button>

            {/* File name */}
            <span className="text-sm text-muted-foreground truncate max-w-[200px]">
              {fileName}
            </span>
          </div>
        ) : (
          <Input
            id={fieldName}
            type={fieldType}
            readOnly={fieldReadOnly}
            placeholder={fieldPlaceholder}
            value={value}
            className={`${leadingAddon ? "rounded-l-none" : ""} ${
              fieldReadOnly ? "bg-muted cursor-not-allowed" : ""
            }`}
            {...register(fieldName, {
              ...(fieldRequired && { required: `${fieldLabel} is required` }),
              ...rules,
            })}
          />
        )}
      </div>

      {/* Preview */}
      {previewUrl && (
        <div className="mt-20">
          {/\.(mp4|mov|avi|mkv|webm)$/i.test(previewUrl) ? (
            <video
              src={previewUrl}
              controls
              className="w-48 rounded-md border mt-3"
            />
          ) : (
            <img
              src={previewUrl}
              alt="Preview"
              className="w-32 rounded-md border mt-3"
            />
          )}
        </div>
      )}

      {/* Description + Add More */}
      {(desc || addnewInputfile) && (
        <div className="flex gap-3 items-center mt-1">
          {desc && (
            <span className="text-muted-foreground text-xs">{desc}</span>
          )}

          {addnewInputfile && (
            <Button
              size="sm"
              type="button"
              variant="secondary"
              className="text-xs px-2 py-1 bg-blue-500 text-white hover:bg-blue-600"
              onClick={onAddNewInput}
            >
              {addnewInputfile}
            </Button>
          )}
        </div>
      )}
    </DynamicFieldWrapper>
  );
}
