// app/lib/crud/crudValidation.ts

import { z } from "zod";

export const CrudIdSchema = z.union([
  z.string(),
  z.number(),
]);

export const CrudCreateSchema = z.record(z.string(), z.any());

export const CrudUpdateSchema = z.object({
  id: CrudIdSchema,
  values: z.record(z.string(), z.any()),
});

export const CrudDeleteSchema = z.object({
  id: CrudIdSchema,
});