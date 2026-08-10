import { buildForm } from "@/lib/form-builder/formBuilder";

import { DynamicForm } from "@/lib/form-builder/formTypes";

/**
 * ==========================================================
 * Page Form Resolver
 * ==========================================================
 *
 * Connects the Page Builder with the existing
 * Dynamic Form Builder.
 *
 * Flow:
 *
 * Entity Metadata
 *       ↓
 * resolvePageForm()
 *       ↓
 * buildForm()
 *       ↓
 * DynamicForm
 */
export function resolvePageForm(
  metadata: Record<string, any>
): DynamicForm {
  if (!metadata) {
    throw new Error(
      "Entity metadata is required to build the page form."
    );
  }

  return buildForm(metadata);
}

/**
 * ==========================================================
 * Resolve Form Configuration
 * ==========================================================
 *
 * Resolves the page-level form configuration.
 *
 * This does NOT build the form fields.
 * Field generation remains the responsibility of
 * lib/form-builder.
 */
export function resolvePageFormConfig(
  config: {
    form?: {
      modal?: boolean;
      width?: string;
      submitText?: string;
      cancelText?: string;
      resetOnSubmit?: boolean;
    };
  }
) {
  return {
    modal:
      config.form?.modal !== false,

    width:
      config.form?.width ?? "4xl",

    submitText:
      config.form?.submitText ?? "Save",

    cancelText:
      config.form?.cancelText ?? "Cancel",

    resetOnSubmit:
      config.form?.resetOnSubmit !== false,
  };
}

/**
 * ==========================================================
 * Resolve Form Mode
 * ==========================================================
 *
 * Determines whether the form is being used for
 * create, edit, or view.
 */
export type PageFormMode =
  | "create"
  | "edit"
  | "view";

export function resolvePageFormMode(
  mode: PageFormMode
): {
  readonly: boolean;
  submitEnabled: boolean;
} {
  switch (mode) {
    case "view":
      return {
        readonly: true,
        submitEnabled: false,
      };

    case "edit":
      return {
        readonly: false,
        submitEnabled: true,
      };

    case "create":
    default:
      return {
        readonly: false,
        submitEnabled: true,
      };
  }
}
