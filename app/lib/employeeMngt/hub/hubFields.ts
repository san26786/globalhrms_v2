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
  /** Read-only (a value the server works out, shown for information). */
  readOnly?: (values: HubValues, flags: HubFormModel['flags']) => boolean;
  /** A select whose options belong to the value of another field (HubOption.parent). */
  dependsOn?: string;
}

export interface HubColumnDef {
  key: string;
  header: string;
  /** Form Settings attribute (defaults to key). */
  attribute?: string;
  sortable?: boolean;
  /** Row key the column sorts by (default: key), e.g. a month name sorted by its number. */
  sortKey?: string;
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
  /** A worklist over another screen's records: no add, rows open that screen's edit form. */
  editsWith?: HubScreenKey;
  /** The attachment: shown as a picture on the edit form; `required` — it cannot be removed, only replaced. */
  file?: { image?: boolean; required?: boolean };
  /** Warnings shown on the form once the chosen employee's details load (e.g. pending loans). */
  notices?: (extras: HubExtras, values: HubValues) => string[];
  /**
   * Fields the form fills while the user types (CI JS such as dependent_dtl.js calculateAge): when one of `from` is
   * changed by the user (never by the record loading), `field` is set to `value(values)`; null leaves it as it is.
   */
  computed?: Array<{ field: string; from: string[]; value: (values: HubValues) => string | null }>;
}

/** Per-option data from /employee-options, by list name and option value. */
export type HubExtras = Record<string, Record<string, Record<string, unknown>>>;

export type HubDefsMap = Record<HubScreenKey, HubScreenDefs>;

export const fieldIsHidden = (field: HubFieldDef, values: HubValues, flags: HubFormModel['flags']) => !!field.hidden?.(values, flags);
export const fieldIsRequired = (field: HubFieldDef, values: HubValues, flags: HubFormModel['flags']) =>
  typeof field.required === 'function' ? field.required(values, flags) : !!field.required;
