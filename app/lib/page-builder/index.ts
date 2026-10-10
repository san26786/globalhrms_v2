/**
 * 2026-09-13 — Dashboard Menu CRUD
 * 
 * The page-builder library provides core utilities for dynamic page rendering,
 * but does NOT include business logic or domain models for specific entities
 * like Dashboard Menus. The business rules for menus (permissions, hierarchy,
 * branding, module dependencies, etc.) live in other modules (e.g., MenuService)
 * or custom components in \`app/\`).
 * 
 * The utilities below are re-exported for convenience so that the page-builder
 * utilities remain accessible under a single \`@/lib/page-builder/*\` umbrella
 * (as they have been), but they do not add or change menu-specific behavior.
 */

export * from "@/lib/page-builder/pageTypes";

export * from "@/lib/page-builder/pageConfig";

export * from "@/lib/page-builder/pageBreadcrumbHeader";

export * from "@/lib/page-builder/breadcrumbs";

export * from "@/lib/page-builder/pageLoader";

export * from "@/lib/page-builder/pageBuilder";

export * from "@/lib/page-builder/pageResolver";

export * from "@/lib/page-builder/pageActions";

export * from "@/lib/page-builder/pageRenderer";


