// app/lib/form-builder/utils/visibility.ts

import { DynamicField } from "../formTypes";

/**
 * Context passed while evaluating field visibility.
 */
export interface VisibilityContext {
  values?: Record<string, any>;
  userRole?: string;
  permissions?: string[];
}

/**
 * Returns whether a field should be visible.
 */
export function isFieldVisible(
  field: DynamicField,
  context: VisibilityContext = {}
): boolean {
  // Hidden fields are never rendered
  if (field.type === "hidden") {
    return false;
  }

  // Disabled fields are still visible
  if (field.disabled === true) {
    return true;
  }

  // Default behaviour
  return true;
}

/**
 * Returns only visible fields.
 */
export function getVisibleFields(
  fields: DynamicField[],
  context: VisibilityContext = {}
): DynamicField[] {
  return fields.filter((field) => isFieldVisible(field, context));
}

/**
 * Groups visible fields by display order.
 */
export function sortVisibleFields(
  fields: DynamicField[],
  context: VisibilityContext = {}
): DynamicField[] {
  return getVisibleFields(fields, context).sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0)
  );
}