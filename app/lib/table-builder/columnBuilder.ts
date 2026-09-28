// app/lib/table-builder/columnBuilder.ts

import { ColumnDef } from "@tanstack/react-table";

export interface DisplayField {
  accessorKey: string;
  header: string;
  visible?: boolean;
  /**
   * Text box in the DataTable filter row (CI DataTables column search). Default true.
   * On server-paged tables it only appears when the endpoint applies column filters.
   */
  filterable?: boolean;
  /** Header click-to-sort. Default true. */
  sortable?: boolean;
}

/**
 * DisplayField[] → TanStack columns. Row selection (the leading checkbox column) is a table-level
 * option of <DataTable selectable /> rather than a per-column one, so it is not configured here.
 */
export function columnBuilder<T>(
  fields: DisplayField[]
): ColumnDef<T>[] {
  return fields
    .filter((field) => field.visible !== false)
    .map((field) => ({
      accessorKey: field.accessorKey,
      header: field.header,
      enableColumnFilter: field.filterable !== false,
      enableSorting: field.sortable !== false,
    }));
}
