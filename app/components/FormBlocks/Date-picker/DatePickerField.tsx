"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { useController } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import DynamicFieldWrapper from "@/components/DynamicForm/DynamicFieldWrapper";

interface DatePickerBlockProps {
  label: string;
  name: string;
  control: any;
  required?: boolean;
  errors?: any;
}

export function DatePickerField({
  label,
  name,
  control,
  required = false,
  errors,
}: DatePickerBlockProps) {
  const [open, setOpen] = React.useState(false);

  const {
    field: { value, onChange },
  } = useController({
    name,
    control,
    rules: required
      ? { required: `${label} is required` }
      : {},
  });

  return (
    <DynamicFieldWrapper
      label={label}
      required={required}
      htmlFor={name}
      error={errors?.[name]?.message}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            id={name}
            className="w-1/2 justify-between font-normal p-4"
          >
            {value
              ? new Date(value).toLocaleDateString()
              : "Select date"}
            <ChevronDownIcon />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            selected={value ? new Date(value) : undefined}
            captionLayout="dropdown"
            onSelect={(date) => {
              onChange(date?.toISOString() || null);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </DynamicFieldWrapper>
  );
}
