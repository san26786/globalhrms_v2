import type {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  RowSelectionState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import type { LucideIcon } from "lucide-react";

/** A single row action shown in the row's kebab menu (edit / view / delete / custom). */
export interface RowAction<TData> {
  label: string;
  icon?: LucideIcon;
  onClick: (row: TData) => void;
  /** Render only when this returns true (or is omitted). Useful for permission checks. */
  show?: (row: TData) => boolean;
  /** Disable the action for this row. */
  disabled?: (row: TData) => boolean;
  variant?: "default" | "destructive";
  /** Adds a separator above this item in the menu. */
  separator?: boolean;
}

/** One option for a faceted (multi-select) column filter, e.g. status = draft | published. */
export interface FacetedFilterOption {
  label: string;
  value: string;
  icon?: LucideIcon;
}

/** Config for a single toolbar filter dropdown, bound to one column id. */
export interface FacetedFilter {
  columnId: string;
  title: string;
  options: FacetedFilterOption[];
}

/** A bulk action shown in the bulk-actions bar when rows are selected. */
export interface BulkAction<TData> {
  label: string;
  icon?: LucideIcon;
  onClick: (rows: TData[]) => void;
  variant?: "default" | "destructive" | "outline" | "secondary";
  /** Ask for confirmation before firing onClick (renders a native confirm by default via onClick itself). */
  requiresSelection?: boolean;
}

/** Server-side pagination/sorting/filtering hook-up. Omit for fully client-side tables. */
export interface ServerSideState {
  pageCount: number;
  /** Total matching rows reported by the server (shown in the pagination footer). */
  totalRows?: number;
  onPaginationChange: (pagination: PaginationState) => void;
  onSortingChange?: (sorting: SortingState) => void;
  onGlobalFilterChange?: (value: string) => void;
  isFetching?: boolean;
}

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Shows the skeleton state instead of rows. */
  isLoading?: boolean;
  /** Column id used for the free-text search box (client-side only). */
  searchColumnId?: string;
  searchPlaceholder?: string;
  /** Faceted (multi-select) filters rendered in the toolbar. */
  facetedFilters?: FacetedFilter[];
  /** "+ Add" button in the toolbar. Omit to hide it. */
  onAdd?: () => void;
  addLabel?: string;
  /** Per-row actions rendered via <DataTableActions />. Omit if you add your own actions column. */
  rowActions?: RowAction<TData>[];
  /** Actions available once >=1 row is selected. Enables row selection automatically. */
  bulkActions?: BulkAction<TData>[];
  /** Wire up server-side pagination/sorting instead of TanStack's client-side row models. */
  serverSide?: ServerSideState;
  pageSize?: number;
  pageSizeOptions?: number[];
  emptyTitle?: string;
  emptyDescription?: string;
  /** Called with the currently selected rows whenever selection changes. */
  onRowSelectionChange?: (rows: TData[]) => void;
  /** Row click handler, e.g. to navigate to a detail page. */
  onRowClick?: (row: TData) => void;
  getRowId?: (row: TData, index: number) => string;
  className?: string;
  /** Module slug (kept for existing callers; not required). */
  entity?: string;
  search?: string;
}

export interface DataTableState {
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  columnVisibility: VisibilityState;
  rowSelection: RowSelectionState;
  globalFilter: string;
  pagination: PaginationState;
}
