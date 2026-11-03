// app/lib/form-builder/validationBuilder.ts

import { z } from "zod";
import type { RegisterOptions } from "react-hook-form";

import type { DynamicField } from "./formTypes";

export function buildValidationSchema(
  fields: DynamicField[]
) {
  const schema: Record<string, any> = {};

  fields.forEach((field) => {
    switch (field.type) {
      case "number":
        schema[field.name] = z.number();
        break;

      case "email":
        schema[field.name] = z.string().email();
        break;

      default:
        schema[field.name] = field.required
          ? z.string().min(1, `${field.label} is required`)
          : z.string().optional();
    }
  });

  return z.object(schema);
}

/**
 * react-hook-form rules for a field: `required` plus its serializable `rules` (CI form_validation
 * min_length / max_length / regex_match / greater_than / less_than).
 */
export function toRegisterRules(field: DynamicField): RegisterOptions {
  const r = field.rules ?? {};
  const label = field.label || field.name;
  return {
    ...(field.required ? { required: `${label} is required` } : {}),
    ...(r.minLength !== undefined ? { minLength: { value: r.minLength, message: `Must be at least ${r.minLength} characters.` } } : {}),
    ...(r.maxLength !== undefined ? { maxLength: { value: r.maxLength, message: `Must be at most ${r.maxLength} characters.` } } : {}),
    ...(r.min !== undefined ? { min: { value: r.min, message: `Must be at least ${r.min}.` } } : {}),
    ...(r.max !== undefined ? { max: { value: r.max, message: `Must be at most ${r.max}.` } } : {}),
    ...(r.pattern ? { pattern: { value: new RegExp(r.pattern), message: r.patternMessage ?? `${label} is invalid.` } } : {}),
  };
}
