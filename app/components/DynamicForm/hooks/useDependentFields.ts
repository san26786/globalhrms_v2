"use client";

import { useCallback, useEffect, useState } from "react";
import { UseFormReturn, FieldValues } from "react-hook-form";

export interface SelectOption {
  label: string;
  value: string | number;
}

export interface DependentFieldConfig {
  /**
   * Parent field name
   * Example: country_id
   */
  parentField: string;

  /**
   * Child field name
   * Example: state_id
   */
  childField: string;

  /**
   * API endpoint
   * Example:
   * /api/crud/state
   */
  endpoint: string;

  /**
   * Query parameter name
   * Example:
   * country_id
   */
  queryParam?: string;

  /**
   * Label field returned by API
   */
  labelKey?: string;

  /**
   * Value field returned by API
   */
  valueKey?: string;
}

interface UseDependentFieldsProps<T extends FieldValues> {
  form: UseFormReturn<T>;

  dependencies: DependentFieldConfig[];
}

export function useDependentFields<T extends FieldValues>({
  form,
  dependencies,
}: UseDependentFieldsProps<T>) {
  const [options, setOptions] = useState<
    Record<string, SelectOption[]>
  >({});

  const [loading, setLoading] = useState<
    Record<string, boolean>
  >({});

  const loadOptions = useCallback(
    async (
      config: DependentFieldConfig,
      value: unknown
    ) => {
      if (
        value === undefined ||
        value === null ||
        value === ""
      ) {
        setOptions((prev) => ({
          ...prev,
          [config.childField]: [],
        }));

        form.setValue(
          config.childField as never,
          "" as never
        );

        return;
      }

      try {
        setLoading((prev) => ({
          ...prev,
          [config.childField]: true,
        }));

        const param =
          config.queryParam ??
          config.parentField;

        const response = await fetch(
          `${config.endpoint}?${param}=${value}`
        );

        const json = await response.json();

        const rows =
          json.data ??
          json.rows ??
          [];

        const mapped = rows.map(
          (item: Record<string, unknown>) => ({
            label: String(
              item[
                config.labelKey ??
                  "label"
              ]
            ),
            value:
              (item[
                config.valueKey ??
                  "value"
              ] as string | number) ??
              "",
          })
        );

        setOptions((prev) => ({
          ...prev,
          [config.childField]: mapped,
        }));

        form.setValue(
          config.childField as never,
          "" as never
        );
      } catch (error) {
        console.error(error);

        setOptions((prev) => ({
          ...prev,
          [config.childField]: [],
        }));
      } finally {
        setLoading((prev) => ({
          ...prev,
          [config.childField]: false,
        }));
      }
    },
    [form]
  );

  useEffect(() => {
    const subscriptions = dependencies.map(
      (config) =>
        form.watch((values, info) => {
          if (
            info.name ===
            config.parentField
          ) {
            loadOptions(
              config,
              values[
                config.parentField as keyof typeof values
              ]
            );
          }
        })
    );

    return () => {
      subscriptions.forEach((sub) =>
        sub.unsubscribe()
      );
    };
  }, [
    dependencies,
    form,
    loadOptions,
  ]);

  return {
    options,
    loading,
  };
}

export default useDependentFields;