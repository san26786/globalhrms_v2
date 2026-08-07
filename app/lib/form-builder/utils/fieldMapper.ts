// app/lib/form-builder/utils/fieldMapper.ts

import { DynamicField, FieldType } from "../formTypes";

/**
 * Maps database control type to DynamicField FieldType
 */
export function mapControlType(controlType?: string): FieldType {
  switch ((controlType || "").toLowerCase()) {
    case "text":
      return "text";

    case "textarea":
      return "textarea";

    case "number":
      return "number";

    case "email":
      return "email";

    case "password":
      return "password";

    case "select":
    case "dropdown":
      return "select";

    case "checkbox":
      return "checkbox";

    case "radio":
      return "radio";

    case "date":
      return "date";

    case "datetime":
      return "datetime";

    case "time":
      return "time";

    case "file":
      return "file";

    case "switch":
    case "toggle":
      return "switch";

    case "hidden":
      return "hidden";

    default:
      return "text";
  }
}

/**
 * Converts one entity attribute record into a DynamicField
 */
export function mapAttributeToField(attr: any): DynamicField {
  const display = attr.entity_obj_attrbt_dsply_dtl?.[0];

  return {
    name: attr.OBJ_ATTRBT_NM,
    label:
      display?.LABEL ??
      display?.OBJ_ATTRBT_DSPLY_NM ??
      attr.OBJ_ATTRBT_NM,

    type: mapControlType(
      display?.CONTROL_TYPE ??
      display?.OBJ_ATTRBT_DSPLY_NM
    ),

    placeholder: display?.PLACEHOLDER ?? "",

    required:
      attr.IS_REQUIRED === 1 ||
      attr.IS_MANDATORY === 1,

    disabled: attr.IS_DISABLED === 1,

    readOnly: attr.IS_READONLY === 1,

    defaultValue: attr.DEFAULT_VALUE,

    width: display?.WIDTH ?? 12,

    order: attr.OBJ_ATTRBT_SEQ ?? 0,

    options: [],
  };
}

/**
 * Converts all entity attributes into DynamicFields
 */
export function mapAttributesToFields(
  attributes: any[]
): DynamicField[] {
  return attributes
    .map(mapAttributeToField)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}