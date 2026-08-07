"use client";

import React, { ReactNode, useEffect } from "react";
import {
  DefaultValues,
  FieldValues,
  FormProvider as RHFProvider,
  SubmitHandler,
  UseFormReturn,
  useForm,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ZodTypeAny } from "zod";

export interface DynamicFormProviderProps<T extends FieldValues> {
  children: ReactNode;

  /**
   * Zod schema generated from metadata
   */
  schema?: ZodTypeAny;

  /**
   * Initial values
   */
  defaultValues?: DefaultValues<T>;

  /**
   * Existing record values (Edit mode)
   */
  values?: Partial<T>;

  /**
   * Submit callback
   */
  onSubmit: SubmitHandler<T>;

  /**
   * Form mode
   */
  mode?: "onSubmit" | "onBlur" | "onChange" | "onTouched" | "all";

  /**
   * Disable entire form
   */
  disabled?: boolean;

  /**
   * Extra RHF methods callback
   */
  onReady?: (methods: UseFormReturn<T>) => void;

  className?: string;
}

export default function FormProvider<T extends FieldValues>({
  children,
  schema,
  defaultValues,
  values,
  onSubmit,
  mode = "onSubmit",
  disabled = false,
  onReady,
  className,
}: DynamicFormProviderProps<T>) {
  const methods = useForm<T>({
    mode,
    resolver: schema ? zodResolver(schema) : undefined,
    defaultValues,
    disabled,
  });

  const {
    handleSubmit,
    reset,
  } = methods;

  /**
   * Populate form when editing
   */
  useEffect(() => {
    if (values) {
      reset(values as DefaultValues<T>);
    }
  }, [values, reset]);

  /**
   * Expose methods to parent if needed
   */
  useEffect(() => {
    onReady?.(methods);
  }, [methods, onReady]);

  return (
    <RHFProvider {...methods}>
      <form
        className={className}
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
        {children}
      </form>
    </RHFProvider>
  );
}