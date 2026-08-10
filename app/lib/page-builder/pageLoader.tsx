import { resolvePageConfig } from "@/lib/page-builder/pageResolver";
import { LoadedPage } from "@/lib/page-builder/pageTypes";

import { EntityService } from "@/lib/entity/entityService";

import { resolvePageForm } from "@/lib/page-builder/pageFormResolver";
import { resolvePageTable } from "@/lib/page-builder/pageTableResolver";
import { PageConfig, PageRenderState } from "@/lib/page-builder/pageTypes";

/**
 * ==========================================================
 * Page Loader
 * ==========================================================
 *
 * Loads the metadata/configuration required to render
 * an entity-driven page.
 *
 * Responsibilities:
 *
 * 1. Load entity metadata
 * 2. Resolve page configuration
 * 3. Resolve breadcrumbs
 * 4. Build dynamic form schema
 * 5. Build table definition
 *
 * CRUD records are loaded separately by:
 *
 * pageDataLoader.ts
 */
export class PageLoader {
  private static entityService =
    new EntityService();

  /**
   * ========================================================
   * Load Complete Page
   * ========================================================
   */
  static async load(
    entityId: number
  ): Promise<LoadedPage> {
    /**
     * ------------------------------------------------------
     * 1. Load Entity Metadata
     * ------------------------------------------------------
     */
    const metadata =
      await this.entityService.getEntityMetadata(
        entityId
      );

    if (!metadata) {
      throw new Error(
        `Entity ${entityId} not found.`
      );
    }

    /**
     * ------------------------------------------------------
     * 2. Resolve Entity Name
     * ------------------------------------------------------
     *
     * Different metadata implementations may use
     * different property names.
     */
    const entity =
      metadata.OBJ_NM ??
      metadata.OBJ_TYP ;
    if (!entity) {
      throw new Error(
        `Entity name not found for entity ${entityId}.`
      );
    }

    /**
     * ------------------------------------------------------
     * 3. Resolve Page Configuration
     * ------------------------------------------------------
     *
     * pageResolver handles:
     *
     * - page config
     * - breadcrumbs
     * - metadata overrides
     */
    const config =
      resolvePageConfig(
        entity,
        metadata
      );

    /**
     * ------------------------------------------------------
     * 4. Build Dynamic Form
     * ------------------------------------------------------
     */
    const formSchema =
      resolvePageForm(
        metadata
      );

    /**
     * ------------------------------------------------------
     * 5. Build DataTable Definition
     * ------------------------------------------------------
     */
    const tableColumns =
      resolvePageTable(
        metadata
      );

    /**
     * ------------------------------------------------------
     * 6. Return Page Definition
     * ------------------------------------------------------
     *
     * tableData is intentionally empty.
     *
     * Actual CRUD records will be loaded through:
     *
     * pageDataLoader.ts
     */
    return {
      config,

      metadata,

      formSchema,

      tableColumns,

      tableData: [],

      total: 0,

      loading: false,
    };
  }

  /**
   * ========================================================
   * Get Page Configuration
   * ========================================================
   */
  static async getConfig(
    entityId: number
  ) {
    const page =
      await this.load(entityId);

    return page.config;
  }

  /**
   * ========================================================
   * Get Dynamic Form
   * ========================================================
   */
  static async getForm(
    entityId: number
  ) {
    const page =
      await this.load(entityId);

    return page.formSchema;
  }

  /**
   * ========================================================
   * Get Table Definition
   * ========================================================
   */
  static async getTable(
    entityId: number
  ) {
    const page =
      await this.load(entityId);

    return page.tableColumns;
  }

  /**
   * ========================================================
   * Check Entity Exists
   * ========================================================
   */
  static async exists(
    entityId: number
  ): Promise<boolean> {
    const entity =
      await this.entityService.getEntity(
        entityId
      );

    return !!entity;
  }
}

export default PageLoader;