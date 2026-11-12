// app/lib/form-builder/formTypes.ts

import { FieldError } from "react-hook-form";
import { ZodTypeAny } from "zod";

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "password"
  | "select"
  | "checkbox"
  | "radio"
  | "date"
  | "datetime"
  | "time"
  /** Native date input; the value is the calendar day "yyyy-mm-dd" (DATE columns). */
  | "date-input"
  | "file"
  | "switch"
  | "hidden";

export interface SelectOption {
  label: string;
  value: string | number;
}

/**
 * Serializable client-side validation (CI form_validation rules that can run in the browser).
 * The API stays authoritative; these only give earlier feedback. Plain data so an init endpoint
 * can send them as JSON.
 */
export interface FieldRules {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  /** Regular expression source (no slashes). */
  pattern?: string;
  patternMessage?: string;
}

/**
 * CI form-script show/hide: the field is shown only while `field`'s current value equals one of
 * `in` (or is non-empty when `in` is omitted).
 */
export interface FieldCondition {
  field: string;
  in?: Array<string | number | boolean>;
}

export interface DynamicField {
  id?: number | string;
  name: string;
  label: string;
  type: string;

  options?: SelectOption[];

  placeholder?: string;

  required?: boolean;

  disabled?: boolean;

  readOnly?: boolean;
  
  hidden?: boolean;

  errors?: FieldError;

  defaultValue?: any;

  validation?: ZodTypeAny;

  width?: number;

  order?: number;

  /**
   * Entity attribute (DB column, CI OBJ_ATTRBT_NM) behind this field: with the form page's
   * objectName set, the field follows the object's Form Settings "Visible in Form".
   */
  attribute?: string;

  /** Section heading the field is grouped under, and its width on a 12-column grid. */
  section?: string;
  colSpan?: number;

  /** Browser-side validation rules (serializable). */
  rules?: FieldRules;

  /** Shown only while the condition holds (CI form-script show/hide). */
  showWhen?: FieldCondition;

  /**
   * Dependent dropdown (CI changeDropdown): options are loaded from this URL, where `{name}`
   * placeholders are filled with current form values. While a referenced value is empty the
   * options stay empty — that is how the child waits for its parent.
   */
  optionsUrl?: string;

  /**
   * CI form script that fills other inputs from the chosen value (e.g. a period fills its start and
   * end dates): when the user changes this field, `url` ({name} placeholders filled with current
   * values) is fetched and every `map` target field is set from that key of the response data.
   * An empty value clears the targets. Loading a record does not trigger it.
   */
  fillFrom?: { url: string; map: Record<string, string> };
}

export interface DynamicForm {
  title?: string;

  fields: DynamicField[];
}