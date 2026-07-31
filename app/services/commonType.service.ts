import { common_type } from "../generated/prisma/client";

import { BaseService } from "./BaseService";

class CommonTypeService extends BaseService<common_type> {
  constructor() {
    super("/api/common/common_type");
  }

  async getDataTypes() {
    const res = await fetch("/api/common/common_type/data-types");
    return res.json();
  }

  async getParentTypes() {
    const res = await fetch("/api/common/common_type/parent-types");
    return res.json();
  }
}

export const commonTypeService = new CommonTypeService();
