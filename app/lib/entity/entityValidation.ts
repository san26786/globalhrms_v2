import { z } from "zod";

export const entitySchema = z.object({
  entityName: z
    .string()
    .min(1, "Entity Name is required"),

  entityCode: z
    .string()
    .min(1, "Entity Code is required"),

  companyId: z.number(),

  branchId: z.number(),

  status: z.number(),
});

export type EntityInput =
    z.infer<typeof entitySchema>;