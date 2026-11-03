// app/lib/form-builder/utils/visibility.ts

import { DynamicField, FieldCondition } from "../formTypes";

/**
 * Context passed while evaluating field visibility.
 */
export interface VisibilityContext {
  values?: Record<string, any>;
  userRole?: string;
  permissions?: string[];
}

const isBlank = (v: unknown) => v === undefined || v === null || v === "" || v === false;

/** Whether a show/hide condition holds for the current values (compared as strings: selects yield strings). */
export function conditionHolds(condition: FieldCondition, values: Record<string, any> = {}): boolean {
  const current = values[condition.field];
  if (!condition.in) return !isBlank(current);
  return condition.in.some((v) => String(v) === String(current ?? ""));
}

/**
 * Returns whether a field should be visible.
 */
export function isFieldVisible(
  field: DynamicField,
  context: VisibilityContext = {}
): boolean {
  // Hidden fields are never rendered (their values are still submitted)
  if (field.type === "hidden" || field.hidden) {
    return false;
  }

  // CI form-script show/hide on another field's value
  if (field.showWhen) {
    return conditionHolds(field.showWhen, context.values);
  }

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

/**
 * Fills `{name}` placeholders of a dependent-dropdown URL with current values (URL-encoded).
 * Returns null while any referenced value is empty — the dropdown waits for its parent.
 */
export function fillUrlTemplate(template: string, values: Record<string, any> = {}): string | null {
  let missing = false;
  const url = template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = values[name];
    if (isBlank(v)) missing = true;
    return encodeURIComponent(String(v ?? ""));
  });
  return missing ? null : url;
}
