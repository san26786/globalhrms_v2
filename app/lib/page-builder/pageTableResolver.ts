import { buildTable } from "@/lib/table-builder/tableBuilder";
import { TableDefinition } from "@/lib/table-builder/tableTypes";

/**
 * ==========================================================
 * Page Table Resolver
 * ==========================================================
 *
 * Connects Page Builder with the existing Table Builder.
 *
 * Flow:
 *
 * Entity Metadata
 *      ↓
 * resolvePageTable()
 *      ↓
 * buildTable()
 *      ↓
 * TableDefinition
 */

/**
 * Resolve table definition from entity metadata.
 */
export function resolvePageTable(
  metadata: Record<string, any>
): TableDefinition {
  if (!metadata) {
    throw new Error(
      "Entity metadata is required to build the page table."
    );
  }

  /**
   * Entity attributes are used by the existing
   * Table Builder to generate table columns.
   */
  const attributes =
    metadata.entity_obj_attrbt ??
    metadata.attributes ??
    [];

  return buildTable(attributes);
}

/**
 * ==========================================================
 * Resolve Page Table Configuration
 * ==========================================================
 *
 * Resolves table behavior from PageConfig.
 *
 * Column generation is still handled by tableBuilder.ts.
 */
export function resolvePageTableConfig(
  config: {
    table?: {
      selectable?: boolean;
      pagination?: boolean;
      sorting?: boolean;
      filtering?: boolean;
      globalSearch?: boolean;
      exportable?: boolean;
      rowActions?: boolean;
      bulkActions?: boolean;
      pageSize?: number;
    };
  }
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