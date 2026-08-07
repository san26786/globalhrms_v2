"use client";

import { Controller, Control, FieldError } from "react-hook-form";
import { Switch } from "@/components/ui/switch";
import { DynamicField } from "@/lib/form-builder/formTypes";

import DynamicFieldWrapper from "./DynamicFieldWrapper";

interface Props {
  field: DynamicField;
  control: Control<any>;
  error?: string | FieldError;
}

export default function SwitchField({ field, control, error }: Props) {
  return (
    <DynamicFieldWrapper label={field.label} required={field.required} error={error}>
      <Controller
        name={field.name}
        control={control}
        defaultValue={false}
        render={({ field: rhf }) => (
          <Switch checked={!!rhf.value} onCheckedChange={rhf.onChange} />
        )}
      />
    </DynamicFieldWrapper>
  );
}
