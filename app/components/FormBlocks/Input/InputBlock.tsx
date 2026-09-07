"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  FieldErrors,
  FieldValues,
  RegisterOptions,
  UseFormRegister,
  Path,
} from "react-hook-form";

import { Upload } from "lucide-react";

interface InputBlockProps<TFieldValues extends FieldValues> {
  label: string;
  name: Path<TFieldValues>;

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

export function InputBlock<
  TFieldValues extends FieldValues = FieldValues
>({
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
}: InputBlockProps<TFieldValues>) {

  const isFile = type === "file";
  const errorMessage = errors?.[name]?.message as string | undefined;
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = React.useState<string>("");

  return (
    <div className="flex gap-2 items-center">
      {/* Label */}
      <div className="w-1/4 space-y-0 text-end">
        <Label htmlFor={name}>
          {label}
          {required && <span className="text-red-500"> *</span>}
        </Label>
      </div>

      {/* Input section */}
      <div className="w-3/4 space-y-0">
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
                ref={fileInputRef}
                id={name}
                type="file"
                accept={accept}
                className="hidden"
                onChange={(e) => {
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
              id={name}
              type={type}
              readOnly={readOnly}
              placeholder={placeholder}
              className={`${leadingAddon ? "rounded-l-none" : ""} ${
                readOnly ? "bg-muted cursor-not-allowed" : ""
              }`}
              {...register(name, {
                ...(required && { required: `${label} is required` }),
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
          <div className="flex gap-3 items-center">
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

        {/* Error */}
        {errorMessage && <p className="text-red-500 text-sm">{errorMessage}</p>}
      </div>
    </div>
  );
}
