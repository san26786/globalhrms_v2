import { BreadcrumbItem } from "./pageTypes";

export interface BreadcrumbOptions {
  dashboardLabel?: string;
  dashboardHref?: string;

  moduleLabel?: string;
  moduleHref?: string;

  entityLabel?: string;
  entityHref?: string;

  includeDashboard?: boolean;
  includeModule?: boolean;
}

const DEFAULT_OPTIONS: BreadcrumbOptions = {
  dashboardLabel: "Dashboard",
  dashboardHref: "/dashboard",

  includeDashboard: true,
  includeModule: true,
};

/**
 * Convert entity name to title.
 *
 * employee
 * employee-master
 * leave_type
 *
 * ↓
 *
 * Employee
 * Employee Master
 * Leave Type
 */
export function formatEntityTitle(entity: string): string {
  return entity
    .replace(/[-_]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1).toLowerCase()
    )
    .join(" ");
}

/**
 * Build breadcrumbs for an entity page.
 */
export function buildBreadcrumbs(
  entity: string,
  options: Partial<BreadcrumbOptions> = {}
): BreadcrumbItem[] {
  const config = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const breadcrumbs: BreadcrumbItem[] = [];

  if (config.includeDashboard) {
    breadcrumbs.push({
      title: config.dashboardLabel!,
      href: config.dashboardHref,
    });
  }

  if (config.includeModule && config.moduleLabel) {
    breadcrumbs.push({
      title: config.moduleLabel,
      href: config.moduleHref,
    });
  }

  breadcrumbs.push({
    title: config.entityLabel ?? formatEntityTitle(entity),
    href: config.entityHref ?? `/${entity}`,
  });

  return breadcrumbs;
}

/**
 * Build breadcrumbs from metadata.
 */
export function buildBreadcrumbsFromMetadata(
  entity: string,
  metadata?: Record<string, any>
): BreadcrumbItem[] {
  return buildBreadcrumbs(entity, {
    moduleLabel: metadata?.moduleName,
    moduleHref: metadata?.modulePath,

    entityLabel:
      metadata?.title ??
      metadata?.entityTitle,
  });
}

/**
 * Append extra breadcrumb.
 */
export function appendBreadcrumb(
  breadcrumbs: BreadcrumbItem[],
  title: string,
  href?: string
): BreadcrumbItem[] {
  return [
    ...breadcrumbs,
    {
      title,
      href,
    },
  ];
}

/**
 * Replace last breadcrumb.
 */
export function replaceLastBreadcrumb(
  breadcrumbs: BreadcrumbItem[],
  title: string,
  href?: string
): BreadcrumbItem[] {
  if (!breadcrumbs.length) return [];

  const list = [...breadcrumbs];

  list[list.length - 1] = {
    title,
    href,
  };

  return list;
}

/**
 * Remove last breadcrumb.
 */
export function removeLastBreadcrumb(
  breadcrumbs: BreadcrumbItem[]
): BreadcrumbItem[] {
  return breadcrumbs.slice(0, -1);
}