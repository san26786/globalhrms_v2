import { entityQueries } from "./entityQueries";

export class EntityRepository {

  /* ==========================
     Entity
  ========================== */
  async getEntityMetadata(entity: number) {
    return entityQueries.getEntityMetadata(entity);
  }

  async getEntityObjects() {
    return entityQueries.getEntityObjects();
  }

  async getEntityList(filters?: any) {
    return entityQueries.getEntityList(filters);
  }
  async getEntity(id: number) {
    return entityQueries.getEntity(id);
  }
  async createEntity(data: any) {
    return entityQueries.createEntity(data);
  }
  async updateEntity(id: number, data: any) {
    return entityQueries.updateEntity(id, data);
  }
  async deleteEntity(id: number) {
    return entityQueries.deleteEntity(id);
  }
  async saveEntity(data: any) {
    return entityQueries.saveEntity(data);
  }

  /* ==========================
     Attributes
  ========================== */
  async getEntityAttributes(entityId: number) {
    return entityQueries.getEntityAttributes(entityId);
  }

  async getAttribute(attributeId: number) {
    return entityQueries.getAttribute(attributeId);
  }

  async saveAttribute(data: any) {
    return entityQueries.saveAttribute(data);
  }

  async updateAttribute(attributeId: number, data: any) {
    return entityQueries.updateAttribute(attributeId, data);
  }

  async deleteAttribute(attributeId: number) {
    return entityQueries.deleteAttribute(attributeId);
  }

  /* ==========================
     Display Details
  ========================== */
  async getDisplayDetails(attributeId: number) {
    return entityQueries.getDisplayDetails(attributeId);
  }

  async getDependentData(attributeId: number) {
    return entityQueries.getDependentData(attributeId);
  }
  async saveDisplayDetails(data: any) {
    return entityQueries.saveDisplayDetails(data);
  }
  async saveDependentData(data: any) {
    return entityQueries.saveDependentData(data);
  }

  async getAttributeMappings(attributeId: number) {
    return entityQueries.getAttributeMappings(attributeId);
  }

  async saveAttributeMapping(data: any) {
    return entityQueries.saveAttributeMapping(data);
  }

  async getEntityMappings(entityId: number) {
    return entityQueries.getEntityMappings(entityId);
  }

  async saveEntityMapping(data: any) {
    return entityQueries.saveEntityMapping(data);
  }

  async getPrivileges(attributeId: number) {
    return entityQueries.getPrivileges(attributeId);
  }

  async savePrivileges(data: any) {
    return entityQueries.savePrivileges(data);
  }

  async getTemporaryEntities() {
    return entityQueries.getTemporaryEntities();
  }

  async saveTemporaryEntity(data: any) {
    return entityQueries.saveTemporaryEntity(data);
  }

  async deleteTemporaryEntity(id: number) {
    return entityQueries.deleteTemporaryEntity(id);
  }
}