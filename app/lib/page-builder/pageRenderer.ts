import {
  PageConfig,
  PageRenderModel,
  PageRenderState,
} from "@/lib/page-builder/pageTypes";

/**
 * ==========================================================
 * Page Renderer
 * ==========================================================
 *
 * Determines what parts of an entity page should be rendered.
 *
 * This file does NOT render React components.
 *
 * Flow:
 *
 * PageConfig + PageRenderState
 *             ↓
 *      resolvePageRenderer()
 *             ↓
 *       PageRenderModel
 *             ↓
 *        pageBuilder.tsx
 */

/**
 * ==========================================================
 * Resolve Page Renderer
 * ==========================================================
 */
export function resolvePageRenderer(
  config: PageConfig,
  state: PageRenderState
): PageRenderModel {
  const permissions =
    config.permissions ?? {};

  const mode =
    state.mode;

  /**
   * List / View pages display the table.
   *
   * Create / Edit pages display the form.
   */
  const showTable =
    mode === "list" ||
    mode === "view";

  const showForm =
    mode === "create" ||
    mode === "edit";

  return {
    /**
     * ------------------------------------------------------
     * Layout
     * ------------------------------------------------------
     */
    showHeader:
      config.layout?.showHeader !== false,

    showBreadcrumb:
      config.layout?.showBreadcrumb !== false,

    showToolbar:
      config.layout?.showToolbar !== false,

    /**
     * ------------------------------------------------------
     * Content
     * ------------------------------------------------------
     */
    showTable,

    showForm,

    /**
     * ------------------------------------------------------
     * Permissions
     * ------------------------------------------------------
     */
    permissions: {
      create:
        permissions.create !== false,

      edit:
        permissions.edit !== false,

      delete:
        permissions.delete !== false,

      view:
        permissions.view !== false,
    },
  };
}

/**
 * ==========================================================
 * Resolve Initial Render State
 * ==========================================================
 */
export function createInitialPageRenderState(): PageRenderState {
  return {
    mode: "list",
    page: 1,
    pageSize: 10,
  };
}

/**
 * ==========================================================
 * Resolve Page Mode
 * ==========================================================
 *
 * Useful when navigating between:
 *
 * list → create
 * list → edit
 * list → view
 */
export function resolvePageMode(
  mode: PageRenderState["mode"],
  selectedId?: string | number
): PageRenderState {
  return {
    mode,
    selectedId,
    page: 1,
    pageSize: 10,
  };
}

/**
 * ==========================================================
 * Is List Mode
 * ==========================================================
 */
export function isListMode(
  state: PageRenderState
): boolean {
  return (
    state.mode === "list"
  );
}

/**
 * ==========================================================
 * Is Create Mode
 * ==========================================================
 */
export function isCreateMode(
  state: PageRenderState
): boolean {
  return (
    state.mode === "create"
  );
}

/**
 * ==========================================================
 * Is Edit Mode
 * ==========================================================
 */
export function isEditMode(
  state: PageRenderState
): boolean {
  return (
    state.mode === "edit"
  );
}

/**
 * ==========================================================
 * Is View Mode
 * ==========================================================
 */
export function isViewMode(
  state: PageRenderState
): boolean {
  return (
    state.mode === "view"
  );
}

/**
 * ==========================================================
 * Can Create
 * ==========================================================
 */
export function canCreate(
  config: PageConfig
): boolean {
  return (
    config.permissions?.create !== false
  );
}

/**
 * ==========================================================
 * Can Edit
 * ==========================================================
 */
export function canEdit(
  config: PageConfig
): boolean {
  return (
    config.permissions?.edit !== false
  );
}

/**
 * ==========================================================
 * Can Delete
 * ==========================================================
 */
export function canDelete(
  config: PageConfig
): boolean {
  return (
    config.permissions?.delete !== false
  );
}

/**
 * ==========================================================
 * Can View
 * ==========================================================
 */
export function canView(
  config: PageConfig
): boolean {
  return (
    config.permissions?.view !== false
  );
}

/**
 * ==========================================================
 * Can Export
 * ==========================================================
 */
export function canExport(
  config: PageConfig
): boolean {
  return (
    config.permissions?.export !== false
  );
}

/**
 * ==========================================================
 * Can Import
 * ==========================================================
 */
export function canImport(
  config: PageConfig
): boolean {
  return (
    config.permissions?.import === true
  );
}