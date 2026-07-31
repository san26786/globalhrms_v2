"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Controller } from "react-hook-form";

// CheckboxBlock
interface CheckboxBlockProps {
  label: string;
  name: string;
  control: any;
}

export function CheckboxBlock({ label, name, control }: CheckboxBlockProps) {
  return (
    <div className="flex gap-2 items-center">
      <div className="w-1/4 space-y-0 text-end">
        <Label>{label}</Label>
      </div>
      <div className="w-3/4 space-y-0">
        <Controller
          name={name}
          control={control}
          defaultValue={false}
          render={({ field }) => (
            <Checkbox
              checked={!!field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </div>
    </div>
  );
}
