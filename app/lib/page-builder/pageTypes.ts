import { ReactNode } from "react";

import { DynamicForm } from "@/lib/form-builder/formTypes";
import { TableDefinition } from "@/lib/table-builder/tableTypes";

/* ==========================================================
   Breadcrumb
========================================================== */

export interface BreadcrumbItem {
  label?: string;
  title?: string;
  href?: string;
  icon?: ReactNode;
}

/* ==========================================================
   Page Actions
========================================================== */

export interface PageAction {
  id: string;
  label: string;
  icon?: ReactNode;

  variant?:
    | "default"
    | "secondary"
    | "outline"
    | "ghost"
    | "destructive";

  permission?: string;

  onClick?: () => void;
}

/* ==========================================================
   Toolbar
========================================================== */

export interface ToolbarConfig {
  showSearch?: boolean;
  showFilters?: boolean;
  showRefresh?: boolean;
  showExport?: boolean;
  showImport?: boolean;
  showColumnToggle?: boolean;

  actions?: PageAction[];
}

/* ==========================================================
   Table
========================================================== */

export interface TableConfig {
  selectable?: boolean;

  pagination?: boolean;

  sorting?: boolean;

  filtering?: boolean;

  globalSearch?: boolean;

  exportable?: boolean;

  rowActions?: boolean;

  bulkActions?: boolean;

  pageSize?: number;
}

/* ==========================================================
   Form
========================================================== */

export interface FormConfig {
  modal?: boolean;

  width?: string;

  submitText?: string;

  cancelText?: string;

  resetOnSubmit?: boolean;
}

/* ==========================================================
   Permissions
========================================================== */

export interface PermissionConfig {
  create?: boolean;

  edit?: boolean;

  delete?: boolean;

  view?: boolean;

  export?: boolean;

  import?: boolean;
}

/* ==========================================================
   Layout
========================================================== */

export interface LayoutConfig {
  title?: string;
  subtitle?: string;
  showHeader?: boolean;
  showBreadcrumb?: boolean;
  showToolbar?: boolean;
}

/* ==========================================================
   API
========================================================== */

export interface ApiConfig {
  baseUrl: string;

  list?: string;

  create?: string;

  update?: string;

  delete?: string;

  details?: string;
}

/* ==========================================================
   Complete Page Config
========================================================== */

export interface PageConfig {
  entity: string;

  title: string;

  subtitle?: string;

  api: ApiConfig;

  layout?: LayoutConfig;

  toolbar?: ToolbarConfig;

  table?: TableConfig;

  form?: FormConfig;

  permissions?: PermissionConfig;

  breadcrumbs?: BreadcrumbItem[];

  metadata?: Record<string, any>;
}

/* ==========================================================
   Page Mode
========================================================== */

export type PageMode =
  | "list"
  | "create"
  | "edit"
  | "view";

/* ==========================================================
   Page Runtime State
========================================================== */

export interface PageRuntimeState {
  search?: string;

  page?: number;

  pageSize?: number;

  sortBy?: string;

  sortOrder?: "asc" | "desc";

  filters?: Record<string, any>;
}

/* ==========================================================
   Page Render State
========================================================== */

export interface PageRenderState {
  mode: PageMode;

  selectedId?: string | number;

  search?: string;

  page?: number;

  pageSize?: number;
}

/* ==========================================================
   Page Render Model
========================================================== */

export interface PageRenderModel {
  showHeader: boolean;

  showBreadcrumb: boolean;

  showToolbar: boolean;

  showTable: boolean;

  showForm: boolean;

  permissions: {
    create: boolean;
    edit: boolean;
    delete: boolean;
    view: boolean;
  };
}

/* ==========================================================
   Loaded Page
========================================================== */

export interface LoadedPage {
  config: PageConfig;

  metadata: any;

  formSchema: DynamicForm;

  tableColumns: TableDefinition;

  /**
   * Records returned by the CRUD API.
   */
  tableData: any[];

  /**
   * Total records available.
   */
  total?: number;

  /**
   * Runtime loading state.
   */
  loading?: boolean;
}