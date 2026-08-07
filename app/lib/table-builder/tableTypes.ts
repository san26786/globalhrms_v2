import { ColumnDef } from "@tanstack/react-table";
import type { TableFilter } from "./filterBuilder";
import type { TableAction } from "./actionBuilder";

export interface TableDefinition<T = unknown> {
  columns: ColumnDef<T>[];
  filters: TableFilter[];
  actions: TableAction[];
}