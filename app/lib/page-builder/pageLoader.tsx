import { createPageConfig } from "./pageConfig";
import { buildBreadcrumbsFromMetadata } from "./breadcrumbs";
import { LoadedPage } from "./pageTypes";

import { EntityService } from "@/lib/entity/entityService";
import { buildTable } from "@/lib/table-builder/tableBuilder";
import { buildForm } from "@/lib/form-builder/formBuilder";

export class PageLoader {
  /**
   * Load everything required for rendering an entity page.
   */
  static async load(entityId: number): Promise<LoadedPage> {
    /**
     * 1. Load metadata
     *
     * Replace this with your actual service method.
     */
    const entityService = new EntityService();
    const metadata = await entityService.getEntityMetadata(entityId);

    if (!metadata) {
      throw new Error(`Entity ${entityId} not found.`);
    }

    /**
     * 2. Build page configuration
     */
    const config = createPageConfig(metadata.OBJ_NM, metadata);

    /**
     * 3. Generate breadcrumb
     */
    config.breadcrumbs = buildBreadcrumbsFromMetadata(
      metadata.OBJ_NM,
      metadata
    );

    /**
     * 4. Generate Dynamic Form
     */
    const formSchema = buildForm(metadata);

    /**
     * 5. Generate DataTable definition
     */
    const tableDefinition = buildTable(metadata.entity_obj_attrbt);

    /**
     * 6. Return
     */
    return {
      config,
      metadata,
      formSchema,
      tableColumns: tableDefinition,
    };
  }
  entityService = new EntityService();
  static async getConfig(entityId: number) {
    return (await this.load(entityId)).config;
  }

  static async getForm(entityId: number) {
    return (await this.load(entityId)).formSchema;
  }

  static async getTable(entityId: number) {
    return (await this.load(entityId)).tableColumns;
  }

  async exists(entityId: number) {
    const entity = await this.entityService.getEntity(entityId);

    return !!entity;
  }
}

export default PageLoader;