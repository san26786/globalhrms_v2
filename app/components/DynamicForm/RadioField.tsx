"use client";

import { Controller, Control, FieldError } from "react-hook-form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { DynamicField } from "@/lib/form-builder/formTypes";

import DynamicFieldWrapper from "./DynamicFieldWrapper";

interface Props {
  field: DynamicField;
  control: Control<any>;
  error?: string | FieldError;
}

export default function RadioField({ field, control, error }: Props) {
  return (
    <DynamicFieldWrapper label={field.label} required={field.required} error={error}>
      <Controller
        name={field.name}
        control={control}
        rules={field.required ? { required: `${field.label} is required` } : {}}
        render={({ field: rhf }) => (
          <RadioGroup value={rhf.value} onValueChange={rhf.onChange}>
            {field.options?.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <RadioGroupItem value={String(option.value)} id={String(option.value)} />
                <Label htmlFor={String(option.value)}>{option.label}</Label>
              </div>
            ))}
          </RadioGroup>
        )}
      />
    </DynamicFieldWrapper>
  );
}
