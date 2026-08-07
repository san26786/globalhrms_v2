import { EntityRepository } from "./entityRepository";

export class EntityService {
  private repository = new EntityRepository();

  /* ==========================
     Entity
  ========================== */

  async getEntityList(filters?: any) {
    return this.repository.getEntityList(filters);
  }

  async getEntity(id: number) {
    return this.repository.getEntity(id);
  }

  async createEntity(data: any) {
    return this.repository.createEntity(data);
  }

  async updateEntity(id: number, data: any) {
    return this.repository.updateEntity(id, data);
  }

  async saveEntity(data: any) {
    return this.repository.saveEntity(data);
  }

  async deleteEntity(id: number) {
    return this.repository.deleteEntity(id);
  }
  async getEntityMetadata(entityId: number) {
    return this.repository.getEntityMetadata(entityId);
  }
  /* ==========================
     Attributes
  ========================== */

  async getEntityAttributes(entityId: number) {
    return this.repository.getEntityAttributes(entityId);
  }

  async getAttribute(attributeId: number) {
    return this.repository.getAttribute(attributeId);
  }

  async saveAttribute(data: any) {
    return this.repository.saveAttribute(data);
  }

  async updateAttribute(attributeId: number, data: any) {
    return this.repository.updateAttribute(attributeId, data);
  }

  async deleteAttribute(attributeId: number) {
    return this.repository.deleteAttribute(attributeId);
  }

  /* ==========================
     Display Details
  ========================== */

  async getDisplayDetails(attributeId: number) {
    return this.repository.getDisplayDetails(attributeId);
  }

  async saveDisplayDetails(data: any) {
    return this.repository.saveDisplayDetails(data);
  }

  /* ==========================
     Dependent Data
  ========================== */

  async getDependentData(attributeId: number) {
    return this.repository.getDependentData(attributeId);
  }

  async saveDependentData(data: any) {
    return this.repository.saveDependentData(data);
  }

  /* ==========================
     Attribute Mapping
  ========================== */

  async getAttributeMappings(attributeId: number) {
    return this.repository.getAttributeMappings(attributeId);
  }

  async saveAttributeMapping(data: any) {
    return this.repository.saveAttributeMapping(data);
  }

  /* ==========================
     Entity Mapping
  ========================== */

  async getEntityMappings(entityId: number) {
    return this.repository.getEntityMappings(entityId);
  }

  async saveEntityMapping(data: any) {
    return this.repository.saveEntityMapping(data);
  }

  /* ==========================
     Privileges
  ========================== */

  async getPrivileges(attributeId: number) {
    return this.repository.getPrivileges(attributeId);
  }

  async savePrivileges(data: any) {
    return this.repository.savePrivileges(data);
  }

  /* ==========================
     Temporary Entity
  ========================== */

  async getTemporaryEntities() {
    return this.repository.getTemporaryEntities();
  }

  async saveTemporaryEntity(data: any) {
    return this.repository.saveTemporaryEntity(data);
  }

  async deleteTemporaryEntity(id: number) {
    return this.repository.deleteTemporaryEntity(id);
  }
}