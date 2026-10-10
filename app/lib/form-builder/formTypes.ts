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
  | "file"
  | "switch"
  | "hidden";

export interface SelectOption {
  label: string;
  value: string | number;
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
}

export interface DynamicForm {
  title?: string;

  fields: DynamicField[];
}