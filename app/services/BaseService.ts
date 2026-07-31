export class BaseService<T> {
  constructor(private endpoint: string) {}

  async getAll() {
    const res = await fetch(this.endpoint);
    if (!res.ok) throw new Error("Failed to fetch data");
    return res.json();
  }

  async getById(id: number) {
    const res = await fetch(`${this.endpoint}/${id}`);
    if (!res.ok) throw new Error("Failed to fetch record");
    return res.json();
  }

  async create(data: T) {
    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) throw new Error("Create failed");
    return res.json();
  }

  async update(id: number, data: T) {
    const res = await fetch(`${this.endpoint}/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) throw new Error("Update failed");
    return res.json();
  }

  async delete(id: number) {
    const res = await fetch(`${this.endpoint}/${id}`, {
      method: "DELETE",
    });

    if (!res.ok) throw new Error("Delete failed");
  }
}