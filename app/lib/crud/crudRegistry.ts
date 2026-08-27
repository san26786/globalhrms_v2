// lib/crud/crudRegistry.ts

import { CrudEntityConfig } from "./crudTypes";

export const CRUD_REGISTRY: Record<string, CrudEntityConfig> = {
  employee: {
    table: "emp_mst",
    primaryKey: "EMP_ID",
  },
  department: {
    table: "department",
    primaryKey: "DEPT_ID",
  },
  designation: {
    table: "designation",
    primaryKey: "DESIGNATION_ID",
  },
};