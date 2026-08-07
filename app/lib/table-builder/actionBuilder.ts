// app/lib/table-builder/actionBuilder.ts

export interface TableAction {
  id: string;
  label: string;
  icon?: string;
  variant?: "default" | "secondary" | "destructive";

  onClick?: (row: any) => void;
}

export function actionBuilder(
  actions: TableAction[]
): TableAction[] {
  return actions;
}

export function defaultCrudActions(): TableAction[] {
  return [
    {
      id: "view",
      label: "View",
    },
    {
      id: "edit",
      label: "Edit",
    },
    {
      id: "delete",
      label: "Delete",
      variant: "destructive",
    },
  ];
}