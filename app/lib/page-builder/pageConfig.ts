import { PageConfig } from "./pageTypes";

/**
 * Default configuration shared by every entity page.
 * Specific metadata loaded from the database will override these values.
 */
const defaultPageConfig: Omit<PageConfig, "entity" | "title" | "api"> = {
  layout: {
    title: "",
    subtitle: "",
    showHeader: true,
    showBreadcrumb: true,
    showToolbar: true,
  },

  toolbar: {
    showSearch: true,
    showFilters: true,
    showRefresh: true,
    showExport: true,
    showImport: false,
    showColumnToggle: true,
    actions: [],
  },

  table: {
    selectable: true,
    pagination: true,
    sorting: true,
    filtering: true,
    globalSearch: true,
    exportable: true,
    rowActions: true,
    bulkActions: true,
    pageSize: 10,
  },

  form: {
    modal: true,
    width: "4xl",
    submitText: "Save",
    cancelText: "Cancel",
    resetOnSubmit: true,
  },

  permissions: {
    create: true,
    edit: true,
    delete: true,
    view: true,
    export: true,
    import: false,
  },

  breadcrumbs: [],

  metadata: {},
};

/**
 * Creates a page configuration for any entity.
 *
 * Example:
 * createPageConfig("employee")
 * createPageConfig("department")
 * createPageConfig("leave-type")
 */
export function createPageConfig(
  entity: string,
  metadata: Record<string, any> = {}
): PageConfig {
  const title =
    metadata.title ??
    entity
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

  return {
    entity,

    title,

    api: {
      baseUrl: `/api/entity/${entity}`,
      list: `/api/entity/${entity}`,
      create: `/api/entity/${entity}`,
      update: `/api/entity/${entity}`,
      delete: `/api/entity/${entity}`,
      details: `/api/entity/${entity}`,
    },

    ...defaultPageConfig,

    layout: {
      ...defaultPageConfig.layout,
      title,
      subtitle: metadata.subtitle ?? "",
    },

    toolbar: {
      ...defaultPageConfig.toolbar,
      ...(metadata.toolbar ?? {}),
    },

    table: {
      ...defaultPageConfig.table,
      ...(metadata.table ?? {}),
    },

    form: {
      ...defaultPageConfig.form,
      ...(metadata.form ?? {}),
    },

    permissions: {
      ...defaultPageConfig.permissions,
      ...(metadata.permissions ?? {}),
    },

    breadcrumbs: metadata.breadcrumbs ?? [],

    metadata,
  };
}

/**
 * Helper to merge runtime metadata into an existing page config.
 */
export function mergePageConfig(
  config: PageConfig,
  overrides: Partial<PageConfig>
): PageConfig {
  return {
    ...config,
    ...overrides,

    layout: {
      ...config.layout,
      ...overrides.layout,
    },

    toolbar: {
      ...config.toolbar,
      ...overrides.toolbar,
    },

    table: {
      ...config.table,
      ...overrides.table,
    },

    form: {
      ...config.form,
      ...overrides.form,
    },

    permissions: {
      ...config.permissions,
      ...overrides.permissions,
    },

    api: {
      ...config.api,
      ...overrides.api,
    },
  };
}

export default createPageConfig;