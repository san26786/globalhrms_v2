// app/lib/table-builder/tableBuilder.ts
import { TableDefinition } from "./tableTypes";
import { columnBuilder } from "./columnBuilder";
import { filterBuilder } from "./filterBuilder";
import { actionBuilder } from "./actionBuilder";

export function buildTable(
  displayFields: any[],
  filters: any[] = [],
  actions: any[] = []
): TableDefinition {
  return {
    columns: columnBuilder(displayFields),
    filters: filterBuilder(filters),
    actions: actionBuilder(actions),
  };
}