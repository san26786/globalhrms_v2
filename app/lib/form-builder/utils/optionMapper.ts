// app/lib/form-builder/utils/optionMapper.ts

import { SelectOption } from "../formTypes";

/**
 * Converts a generic array into SelectOption[]
 *
 * Example:
 * [
 *   { id: 1, name: "Admin" }
 * ]
 *
 * =>
 *
 * [
 *   { label: "Admin", value: 1 }
 * ]
 */
export function mapOptions(
  data: any[] = [],
  labelKey = "label",
  valueKey = "value"
): SelectOption[] {
  return data.map((item) => ({
    label: String(item[labelKey] ?? ""),
    value: item[valueKey],
  }));
}

/**
 * Converts Entity Mapping metadata into SelectOption[]
 *
 * Example:
 * entity_obj_attrbt_mppng
 */
export function mapEntityOptions(
  mappings: any[] = []
): SelectOption[] {
  return mappings.map((item) => ({
    label:
      item.DISP_VALUE ??
      item.NAME ??
      item.OBJ_NM ??
      item.OBJ_ATTRBT_NM ??
      "",

    value:
      item.VALUE ??
      item.ID ??
      item.OBJ_ID ??
      item.OBJ_ATTRBT_ID,
  }));
}

/**
 * Removes duplicate options.
 */
export function uniqueOptions(
  options: SelectOption[]
): SelectOption[] {
  const map = new Map<string | number, SelectOption>();

  for (const option of options) {
    map.set(option.value, option);
  }

  return [...map.values()];
}

/**
 * Sorts options alphabetically.
 */
export function sortOptions(
  options: SelectOption[]
): SelectOption[] {
  return [...options].sort((a, b) =>
    a.label.localeCompare(b.label)
  );
}

/**
 * Complete option pipeline.
 */
export function buildOptions(
  mappings: any[]
): SelectOption[] {
  return sortOptions(
    uniqueOptions(
      mapEntityOptions(mappings)
    )
  );
}