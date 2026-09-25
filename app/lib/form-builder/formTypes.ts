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
}

export interface DynamicForm {
  title?: string;

  fields: DynamicField[];
}