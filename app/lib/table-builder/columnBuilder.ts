// app/lib/table-builder/columnBuilder.ts

import { ColumnDef } from "@tanstack/react-table";

export interface DisplayField {
  accessorKey: string;
  header: string;
  visible?: boolean;
}

export function columnBuilder<T>(
  fields: DisplayField[]
): ColumnDef<T>[] {
  return fields
    .filter((field) => field.visible !== false)
    .map((field) => ({
      accessorKey: field.accessorKey,
      header: field.header,
    }));
}