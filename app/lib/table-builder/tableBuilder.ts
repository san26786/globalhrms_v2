// app/lib/table-builder/tableBuilder.ts
import { TableDefinition } from "./tableTypes";
import { columnBuilder, DisplayField } from "./columnBuilder";
import { filterBuilder, TableFilter } from "./filterBuilder";
import { actionBuilder, TableAction } from "./actionBuilder";

// export function buildTable(
//   displayFields: any[],
//   filters: any[] = [],
//   actions: any[] = []
// ): TableDefinition {
//   return {
//     columns: columnBuilder(displayFields),
//     filters: filterBuilder(filters),
//     actions: actionBuilder(actions),
//   };
// }

//--------------
// lib/table-builder/tableBuilder.ts
export function buildTable<T = unknown>(
  displayFields: DisplayField[],
  filters: TableFilter[] = [],
  actions: TableAction[] = []
): TableDefinition<T> {
  return {
    columns: columnBuilder<T>(displayFields),
    filters: filterBuilder(filters),
    actions: actionBuilder(actions),
  };
}