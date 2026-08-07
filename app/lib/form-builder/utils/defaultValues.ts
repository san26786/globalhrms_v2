// app/lib/form-builder/utils/defaultValues.ts

import { DynamicField } from "../formTypes";

/**
 * Generates React Hook Form default values from DynamicField metadata.
 *
 * `values` (e.g. an existing record when editing) takes precedence over
 * `field.defaultValue`, which takes precedence over the type-based
 * fallback below. This used to also be hand-rolled a second time inside
 * DynamicForm's `useDynamicForm` hook with a much smaller switch (missing
 * date/datetime/time/file/select/radio); that copy has been removed in
 * favor of this one.
 */
export function buildDefaultValues<T extends Record<string, any> = Record<string, any>>(
  fields: DynamicField[],
  values?: Partial<T>
): Record<string, any> {
  return fields.reduce<Record<string, any>>((defaults, field) => {
    if (values && field.name in values) {
      defaults[field.name] = (values as Record<string, any>)[field.name];
      return defaults;
    }

    if (field.defaultValue !== undefined) {
      defaults[field.name] = field.defaultValue;
      return defaults;
    }

    switch (field.type) {
      case "text":
      case "textarea":
      case "email":
      case "password":
      case "hidden":
        defaults[field.name] = "";
        break;

      case "number":
        defaults[field.name] = null;
        break;

      case "checkbox":
      case "switch":
        defaults[field.name] = false;
        break;

      case "select":
      case "radio":
        defaults[field.name] = "";
        break;

      case "date":
      case "datetime":
      case "time":
        defaults[field.name] = null;
        break;

      case "file":
        defaults[field.name] = null;
        break;

      default:
        defaults[field.name] = "";
    }

    return defaults;
  }, {});
}
