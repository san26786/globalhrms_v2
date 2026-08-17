"use client";

import React from "react";

// Existing field components
import RadioField from "./RadioField";
import SwitchField from "./SwitchField";
import DynamicFieldWrapper from "./DynamicFieldWrapper";

// Input Components
import { InputField } from "../FormBlocks/Input/InputField";
import { TextareaField } from "../FormBlocks/Textarea/TextareaField";
import { SelectField } from "../FormBlocks/Select/SelectBlock";
import { CheckboxField } from "../FormBlocks/Checkbox/CheckboxField";
import { DatePickerField } from "../FormBlocks/Date-picker/DatePickerField";
import { ColorPickerField } from "../FormBlocks/ColorPicker/ColorPickerField";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import { UseFormRegister, FieldValues, Control, FieldErrors } from "react-hook-form";

interface FieldFactoryProps {
  field: DynamicField;
  register: UseFormRegister<FieldValues>;
  control: Control<FieldValues>;
  errors: FieldErrors<FieldValues>;
}

/**
 * Single source of truth for "field metadata type -> rendered component".
 * This used to be duplicated in a second file (FormField.tsx) with a
 * different, inconsistent set of type strings ("input" instead of
 * "text"/"email"/... etc). Because FieldFactory wrapped its own switch
 * result in that other component and discarded it, every field type
 * except the handful matching FormField's own switch silently rendered
 * as nothing. FormField.tsx has been removed - this is now the only
 * dispatcher, and it renders its own switch result directly.
 */
export default function FieldFactory({
  field,
  register,
  control,
  errors,
}: FieldFactoryProps) {
  if (field.hidden) return null;

  const type = field.type.toLowerCase();

  switch (type) {
    case "input":
    case "text":
    case "email":
    case "password":
    case "number":
    case "tel":
    case "url":
    case "file":
      return (
        <InputField field={field} register={register} errors={errors} />
      );

    case "textarea":
      return (
        <TextareaField
          label={field.label ?? ""}
          name={field.name}
          register={register}
          required={field.required}
          errors={errors}
        />
      );

    case "select":
    case "dropdown":
      return (
        <SelectField
          label={field.label ?? ""}
          name={field.name}
          control={control}
          options={field.options ?? []}
          rules={field.required ? { required: `${field.label} is required` } : {}}
          error={errors?.[field.name]?.message as string | undefined}
        />
      );

    case "checkbox":
      return (
        <CheckboxField
          label={field.label ?? ""}
          name={field.name}
          control={control}
          required={field.required}
          error={errors?.[field.name] as any}
        />
      );

    case "radio":
      return (
        <RadioField
          field={field}
          control={control}
          error={errors?.[field.name] as any}
        />
      );

    case "switch":
      return (
        <SwitchField
          field={field}
          control={control}
          error={errors?.[field.name] as any}
        />
      );

    case "date":
    case "datepicker":
      return (
        <DatePickerField
          label={field.label ?? ""}
          name={field.name}
          control={control}
          required={field.required}
          errors={errors}
        />
      );

    case "color":
    case "colorpicker":
      return (
        <ColorPickerField
          label={field.label ?? ""}
          name={field.name}
          control={control}
          required={field.required}
          error={errors?.[field.name] as any}
        />
      );

    default:
      return (
        <DynamicFieldWrapper label={field.label} required={field.required}>
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-600">
            Unsupported field type: <strong>{field.type}</strong>
          </div>
        </DynamicFieldWrapper>
      );
  }
}
