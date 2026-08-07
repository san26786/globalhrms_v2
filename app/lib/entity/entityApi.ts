// app/lib/entity/entityApi.ts

export class EntityApi {
  private baseUrl = "/api/entity";

  /* ==========================
     Entity
  ========================== */

  async getEntityList(params?: Record<string, any>) {
    const query = params
      ? `?${new URLSearchParams(params).toString()}`
      : "";

    const response = await fetch(`${this.baseUrl}${query}`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Failed to load entity list.");
    }

    return response.json();
  }

  async getEntity(id: number) {
    const response = await fetch(`${this.baseUrl}/${id}`);

    if (!response.ok) {
      throw new Error("Failed to load entity.");
    }

    return response.json();
  }

  async saveEntity(data: any) {
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error("Failed to save entity.");
    }

    return response.json();
  }

  async updateEntity(id: number, data: any) {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error("Failed to update entity.");
    }

    return response.json();
  }

  async deleteEntity(id: number) {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Failed to delete entity.");
    }

    return response.json();
  }

  /* ==========================
     Attributes
  ========================== */

  async getEntityAttributes(entityId: number) {
    const response = await fetch(
      `/api/entity/attributes?entityId=${entityId}`
    );

    if (!response.ok) {
      throw new Error("Failed to load attributes.");
    }

    return response.json();
  }

  async saveAttribute(data: any) {
    const response = await fetch("/api/entity/attributes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error("Failed to save attribute.");
    }

    return response.json();
  }

  /* ==========================
     Display Details
  ========================== */

  async getDisplayDetails(attributeId: number) {
    const response = await fetch(
      `/api/entity/display?attributeId=${attributeId}`
    );

    if (!response.ok) {
      throw new Error("Failed to load display details.");
    }

    return response.json();
  }

  async saveDisplayDetails(data: any) {
    const response = await fetch("/api/entity/display", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error("Failed to save display details.");
    }

    return response.json();
  }

  /* ==========================
     Mapping
  ========================== */

  async getEntityMappings(entityId: number) {
    const response = await fetch(
      `/api/entity/mapping?entityId=${entityId}`
    );

    if (!response.ok) {
      throw new Error("Failed to load mappings.");
    }

    return response.json();
  }

  async saveEntityMapping(data: any) {
    const response = await fetch("/api/entity/mapping", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error("Failed to save mapping.");
    }

    return response.json();
  }

  /* ==========================
     Dependent Data
  ========================== */

  async getDependentData(attributeId: number) {
    const response = await fetch(
      `/api/entity/dependent-data?attributeId=${attributeId}`
    );

    if (!response.ok) {
      throw new Error("Failed to load dependent data.");
    }

    return response.json();
  }

  async saveDependentData(data: any) {
    const response = await fetch("/api/entity/dependent-data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error("Failed to save dependent data.");
    }

    return response.json();
  }

  /* ==========================
     Privileges
  ========================== */

  async getPrivileges(attributeId: number) {
    const response = await fetch(
      `/api/entity/privileges?attributeId=${attributeId}`
    );

    if (!response.ok) {
      throw new Error("Failed to load privileges.");
    }

    return response.json();
  }

  async savePrivileges(data: any) {
    const response = await fetch("/api/entity/privileges", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error("Failed to save privileges.");
    }

    return response.json();
  }
}

export const entityApi = new EntityApi();