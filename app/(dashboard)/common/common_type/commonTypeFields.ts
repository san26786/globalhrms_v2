export interface FormField {
  type: "input" | "select" | "checkbox" | "textarea" | "date";
  name: string;
  label: string;
  required?: boolean;
  readOnly?: boolean;
  placeholder?: string;

  // Select only
  options?: {
    label: string;
    value: string | number;
  }[];

  // Extra props
  visible?: boolean;
  disabled?: boolean;
  hasLookup?: boolean;
  onLookupClick?: () => void;
}

export function commonTypeFields(
  dataTypes: { label: string; value: string | number }[] = [],
  parentTypes: { label: string; value: string | number }[] = []
): FormField[] {
  return [
    {
      type: "input",
      name: "type_id",
      label: "Type Id",
      required: true,
    },

    {
      type: "input",
      name: "type_code",
      label: "Type Code",
      required: true,
    },

    {
      type: "input",
      name: "type_name",
      label: "Type Name",
      required: true,
    },

    {
      type: "input",
      name: "view_name",
      label: "View Name",
    },

    {
      type: "select",
      name: "dataType",
      label: "Data Type",
      options: dataTypes,
      required: true,
    },

    {
      type: "checkbox",
      name: "visibleToUser",
      label: "Visible To User",
    },

    {
      type: "checkbox",
      name: "userCanCreateData",
      label: "User Can Create Data",
    },

    {
      type: "checkbox",
      name: "isEditable",
      label: "Is Editable",
    },

    {
      type: "checkbox",
      name: "chkParentID",
      label: "Set Parent Type",
    },

    {
      type: "select",
      name: "parent_id",
      label: "Parent Type",
      options: parentTypes,
    },
  ];
}