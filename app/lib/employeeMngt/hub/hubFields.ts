import type { HubFormModel, HubScreenKey, HubValues } from './hubTypes';

/**
 * Field and column definitions of the Employee Hub record screens, shared by the form (rendering)
 * and the server (generic validation: required, length, number / date / e-mail format, option
 * membership). Screen-specific rules live in lib/employeeMngt/hub/screens.
 */

/** 'file': the record's attachment, uploaded after the record is saved (HubConfig.attachment). */
export type HubFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'email' | 'file';

export interface HubFieldDef {
  /** Form / body key. */
  name: string;
  label: string;
  type: HubFieldType;
  required?: boolean | ((values: HubValues, flags: HubFormModel['flags']) => boolean);
  /** Maximum length (text) or digits before the point (number). */
  max?: number;
  /** Key of HubFormModel.options holding this select's choices. */
  options?: string;
  /** Form Settings attribute of the screen's CI view (label / visibility overrides). */
  attribute?: string;
  placeholder?: string;
  /** Hidden fields are neither shown nor validated. */
  hidden?: (values: HubValues, flags: HubFormModel['flags']) => boolean;
  /** Read-only on the edit form. */
  lockedOnEdit?: boolean;
}

export interface HubColumnDef {
  key: string;
  header: string;
  /** Form Settings attribute (defaults to key). */
  attribute?: string;
  sortable?: boolean;
  format?: 'date' | 'yesno';
}

/** One screen's form and list, client-safe (defs/*.ts). */
export interface HubScreenDefs {
  fields: HubFieldDef[];
  columns: HubColumnDef[];
  /** The employee picker's label (CI: "Employee Full Name"). */
  employeeLabel?: string;
  /** Rows offering the delete action (CI hid it on the primary e-mail / phone). */
  canDeleteRow?: (row: Record<string, unknown>) => boolean;
  /** Some dropdowns depend on the chosen employee (loaded from /employee-options when it changes). */
  employeeOptions?: boolean;
  /** Picking a value in `field` fills other fields from employee-options extras[`extras`][value] (field → extras key). */
  prefill?: { field: string; extras: string; set: Record<string, string> };
}

export type HubDefsMap = Record<HubScreenKey, HubScreenDefs>;

export const fieldIsHidden = (field: HubFieldDef, values: HubValues, flags: HubFormModel['flags']) => !!field.hidden?.(values, flags);
export const fieldIsRequired = (field: HubFieldDef, values: HubValues, flags: HubFormModel['flags']) =>
  typeof field.required === 'function' ? field.required(values, flags) : !!field.required;
