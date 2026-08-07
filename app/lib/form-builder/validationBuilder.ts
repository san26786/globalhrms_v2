// app/lib/form-builder/validationBuilder.ts

import { z } from "zod";

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