import type { FormField } from '@/(dashboard)/common/common_type/commonTypeFields';

/**
 * CI: Dashboard_menu::initForm().
 * - parent_module + menu_code only render in ADD mode (id === 0).
 * - menu_name, menu_url, sequence render in both.
 *
 * The 3 icon uploads are intentionally NOT included here. `FormField`
 * (the type DynamicForm actually consumes, per common_type/add/page.tsx)
 * only defines "input" | "select" | "checkbox" | "textarea" | "date" — no
 * "file" variant, unlike the separate/likely-unused `DynamicField` type in
 * lib/form-builder/formTypes.ts. Since DynamicForm's real implementation
 * wasn't available to confirm it can render file inputs, the icon pickers
 * are rendered as plain <input type="file"> elements alongside DynamicForm
 * in add/page.tsx and edit/[id]/page.tsx instead of being smuggled through
 * a field type the form may not support — see those files.
 */
export function dashboardMenuFields(
  mode: 'add' | 'edit',
  parentModuleOptions: { label: string; value: string | number }[] = [],
): FormField[] {
  const fields: FormField[] = [];

  if (mode === 'add') {
    fields.push(
      {
        type: 'select',
        name: 'parentModuleId',
        label: 'Parent Module',
        options: parentModuleOptions,
      },
      {
        type: 'input',
        name: 'menuCode',
        label: 'Menu Code',
        required: true,
      },
    );
  }

  fields.push(
    {
      type: 'input',
      name: 'menuName',
      label: 'Menu Name',
      required: true,
    },
    {
      type: 'input',
      name: 'menuUrl',
      label: 'Menu Url',
      required: true,
    },
    {
      type: 'input',
      name: 'sequence',
      label: 'Sequence',
      required: true,
    },
  );

  return fields;
}
