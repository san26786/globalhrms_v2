"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { useController } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerBlockProps {
  label: string;
  name: string;
  control: any;
  required?: boolean;
  errors?: any;
}

export function DatePickerBlock({
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
    <div className="flex gap-2 items-center">
      {/* LEFT LABEL */}
      <div className="w-1/4 space-y-0 text-end">
        <Label htmlFor={name}>
          {label}
          {required && <span className="text-red-500"> *</span>}
        </Label>
      </div>

      {/* RIGHT SIDE — INPUT */}
      <div className="w-3/4 space-y-0">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild >
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

        {/* Error */}
        {errors && errors[name] && (
          <p className="text-red-500 text-sm">
            {errors[name]?.message}
          </p>
        )}
      </div>
    </div>
  );
}
