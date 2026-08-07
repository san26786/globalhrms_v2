// app/lib/table-builder/filterBuilder.ts

export interface TableFilter {
  key: string;

  label: string;

  type: "text" | "select" | "date";

  options?: {
    label: string;
    value: string | number;
  }[];
}

export function filterBuilder(
  filters: TableFilter[]
) {
  return filters;
}