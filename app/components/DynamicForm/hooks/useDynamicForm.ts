"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DefaultValues,
  FieldValues,
  SubmitHandler,
  UseFormReturn,
  useForm,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ZodTypeAny } from "zod";

import { buildValidationSchema } from "@/lib/form-builder/validationBuilder";
import { buildDefaultValues } from "@/lib/form-builder/utils/defaultValues";

export interface DynamicField {
  name: string;
  type: string;

  label?: string;

  required?: boolean;

  defaultValue?: unknown;

  hidden?: boolean;

  disabled?: boolean;

  readOnly?: boolean;

  options?: Array<{
    label: string;
    value: string | number;
  }>;

  [key: string]: unknown;
}

export interface UseDynamicFormOptions<T extends FieldValues> {
  /**
   * Metadata fields
   */
  fields: DynamicField[];

  /**
   * Edit values
   */
  values?: Partial<T>;

  /**
   * Create defaults
   */
  defaultValues?: DefaultValues<T>;

  /**
   * Form mode
   */
  mode?: "create" | "edit";

  /**
   * Submit callback
   */
  onSubmit: (values: T) => Promise<void> | void;
}

export interface UseDynamicFormReturn<T extends FieldValues> {
  form: UseFormReturn<T>;

  loading: boolean;

  submitting: boolean;

  schema: ZodTypeAny;

  resetForm: () => void;

  submitForm: SubmitHandler<T>;

  defaultValues: DefaultValues<T>;
}

export function useDynamicForm<T extends FieldValues>({
  fields,
  values,
  defaultValues,
  mode = "create",
  onSubmit,
}: UseDynamicFormOptions<T>): UseDynamicFormReturn<T> {
  const [loading, setLoading] = useState(true);

  const [submitting, setSubmitting] = useState(false);

  /**
   * Zod schema
   */
  const schema = useMemo(() => {
    return buildValidationSchema(fields);
  }, [fields]);

  /**
   * RHF defaults
   */
  const defaults = useMemo(() => {
    if (defaultValues) {
      return defaultValues;
    }

    return buildDefaultValues<T>(fields, values) as DefaultValues<T>;
  }, [fields, values, defaultValues]);

  const form = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
    mode: "onSubmit",
  });

  useEffect(() => {
    form.reset(defaults);
    setLoading(false);
  }, [defaults, form]);

  const resetForm = useCallback(() => {
    form.reset(defaults);
  }, [form, defaults]);

  const submitForm: SubmitHandler<T> = useCallback(
    async (data) => {
      try {
        setSubmitting(true);

        await onSubmit(data);

        if (mode === "create") {
          form.reset(defaults);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [defaults, form, mode, onSubmit]
  );

  return {
    form,
    loading,
    submitting,
    schema,
    defaultValues: defaults,
    submitForm,
    resetForm,
  };
}

export default useDynamicForm;