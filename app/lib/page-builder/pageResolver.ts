import {
    createPageConfig,
  } from "@/lib/page-builder/pageConfig";
  
  import {
    buildBreadcrumbsFromMetadata,
  } from "@/lib/page-builder/breadcrumbs";
  
  import {
    PageConfig,
    PermissionConfig,
  } from "@/lib/page-builder/pageTypes";
  
  /**
   * ==========================================================
   * Resolve Page Configuration
   * ==========================================================
   *
   * Combines:
   *
   * Entity
   *   +
   * Entity Metadata
   *   ↓
   * PageConfig
   *
   * This keeps page configuration logic outside
   * pageBuilder.tsx.
   */
  export function resolvePageConfig(
    entity: string,
    metadata: Record<string, any> = {}
  ): PageConfig {
    const config = createPageConfig(
      entity,
      metadata
    );
  
    /**
     * Use metadata breadcrumbs when explicitly
     * provided. Otherwise generate them.
     */
    const breadcrumbs =
      metadata.breadcrumbs ??
      buildBreadcrumbsFromMetadata(
        entity,
        metadata
      );
  
    return {
      ...config,
  
      breadcrumbs,
    };
  }
  
  /**
   * ==========================================================
   * Resolve Page Permissions
   * ==========================================================
   *
   * Converts optional permission settings into
   * predictable boolean values.
   */
  export function resolvePagePermissions(
    config: PageConfig
  ): Required<PermissionConfig> {
    const permissions =
      config.permissions ?? {};
  
    return {
      create:
        permissions.create !== false,
  
      edit:
        permissions.edit !== false,
  
      delete:
        permissions.delete !== false,
  
      view:
        permissions.view !== false,
  
      export:
        permissions.export !== false,
  
      import:
        permissions.import === true,
    };
  }
  
  /**
   * ==========================================================
   * Resolve Page Layout
   * ==========================================================
   */
  export function resolvePageLayout(
    config: PageConfig
  ) {
    return {
      showHeader:
        config.layout?.showHeader !== false,
  
      showBreadcrumb:
        config.layout?.showBreadcrumb !== false,
  
      showToolbar:
        config.layout?.showToolbar !== false,
    };
  }
  
  /**
   * ==========================================================
   * Resolve Page Toolbar
   * ==========================================================
   */
  export function resolvePageToolbar(
    config: PageConfig
  ) {
    return {
      showSearch:
        config.toolbar?.showSearch !== false,
  
      showFilters:
        config.toolbar?.showFilters !== false,
  
      showRefresh:
        config.toolbar?.showRefresh !== false,
  
      showExport:
        config.toolbar?.showExport !== false,
  
      showImport:
        config.toolbar?.showImport === true,
  
      showColumnToggle:
        config.toolbar?.showColumnToggle !== false,
  
      actions:
        config.toolbar?.actions ?? [],
    };
  }
  
  /**
   * ==========================================================
   * Resolve Page Table
   * ==========================================================
   */
  export function resolvePageTableConfig(
    config: PageConfig
  ) {
    return {
      selectable:
        config.table?.selectable !== false,
  
      pagination:
        config.table?.pagination !== false,
  
      sorting:
        config.table?.sorting !== false,
  
      filtering:
        config.table?.filtering !== false,
  
      globalSearch:
        config.table?.globalSearch !== false,
  
      exportable:
        config.table?.exportable !== false,
  
      rowActions:
        config.table?.rowActions !== false,
  
      bulkActions:
        config.table?.bulkActions !== false,
  
      pageSize:
        config.table?.pageSize ?? 10,
    };
  }
  
  /**
   * ==========================================================
   * Resolve Page Form
   * ==========================================================
   */
  export function resolvePageFormConfig(
    config: PageConfig
  ) {
    return {
      modal:
        config.form?.modal !== false,
  
      width:
        config.form?.width ?? "4xl",
  
      submitText:
        config.form?.submitText ?? "Save",
  
      cancelText:
        config.form?.cancelText ?? "Cancel",
  
      resetOnSubmit:
        config.form?.resetOnSubmit !== false,
    };
  }
  
  /**
   * ==========================================================
   * Resolve Complete Page
   * ==========================================================
   *
   * Useful when the renderer needs all resolved
   * configuration in one object.
   */
  export function resolvePage(
    entity: string,
    metadata: Record<string, any> = {}
  ) {
    const config =
      resolvePageConfig(
        entity,
        metadata
      );
  
    return {
      config,
  
      permissions:
        resolvePagePermissions(config),
  
      layout:
        resolvePageLayout(config),
  
      toolbar:
        resolvePageToolbar(config),
  
      table:
        resolvePageTableConfig(config),
  
      form:
        resolvePageFormConfig(config),
    };
  }