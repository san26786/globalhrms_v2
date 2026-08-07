// app/lib/form-builder/utils/readonly.ts

import { DynamicField } from "../formTypes";

/**
 * Context used to determine whether a field should be read-only.
 */
export interface ReadOnlyContext {
  userRole?: string;
  permissions?: string[];
  isEdit?: boolean;
  values?: Record<string, any>;
}

/**
 * Returns true if the field should be read-only.
 */
export function isFieldReadOnly(
  field: DynamicField,
  context: ReadOnlyContext = {}
): boolean {
  // Explicit read-only setting
  if (field.readOnly === true) {
    return true;
  }

  // Disabled fields behave as read-only
  if (field.disabled === true) {
    return true;
  }

  // Future role-based logic can be added here
  // Example:
  // if (
  //   field.roles &&
  //   context.userRole &&
  //   !field.roles.includes(context.userRole)
  // ) {
  //   return true;
  // }

  return false;
}

/**
 * Returns a new field with readOnly applied.
 */
export function applyReadOnly(
  field: DynamicField,
  context: ReadOnlyContext = {}
): DynamicField {
  return {
    ...field,
    readOnly: isFieldReadOnly(field, context),
  };
}

/**
 * Applies read-only rules to all fields.
 */
export function applyReadOnlyToFields(
  fields: DynamicField[],
  context: ReadOnlyContext = {}
): DynamicField[] {
  return fields.map((field) => applyReadOnly(field, context));
}