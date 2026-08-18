/**
 * app/lib/permission/permissionValidation.ts
 *
 * Input validation for the permission ADMIN surface (creating/updating permission_dtl rows —
 * i.e. the Next.js equivalent of the legacy `permission_class` / `permission_dtl` controllers).
 * Uses Zod, matching the pattern in the rest of the codebase's `*Validation.ts` files.
 *
 * Keep this separate from `permissionValidation` usage in the *runtime* authorization engine
 * (permissionEngine.ts) — that path never touches user input, only trusted JWT/session data.
 */
import { z } from 'zod';
import { PermissionAction, PermissionRefType } from './permissionTypes';

export const permissionActionSchema = z.nativeEnum(PermissionAction);
export const permissionRefTypeSchema = z.nativeEnum(PermissionRefType);

/** Validates a single permission_dtl create payload (parity with legacy `insertFunc`). */
export const createPermissionDtlSchema = z.object({
  permissionsClassId: z.number().int().positive(),
  refType: permissionRefTypeSchema,
  refId: z.number().int().positive(),
  resourceId: z.number().int().positive(),
  enabled: z.boolean().default(true),
  readOnly: z.boolean().default(false),
  modify: z.boolean().default(false),
  delete: z.boolean().default(false),
  insert: z.boolean().default(false),
  print: z.boolean().default(false),
  execute: z.boolean().default(false),
  oaId: z.number().int().positive().optional(),
  oaBrandId: z.number().int().positive().optional(),
});
export type CreatePermissionDtlInput = z.infer<typeof createPermissionDtlSchema>;

/** Bulk variant — grant one resourceId to many refIds at once (parity with legacy `insert`). */
export const createPermissionDtlBulkSchema = z.object({
  permissionsClassId: z.number().int().positive(),
  refType: permissionRefTypeSchema,
  refIds: z.array(z.number().int().positive()).min(1),
  resourceIds: z.array(z.number().int().positive()).min(1),
});
export type CreatePermissionDtlBulkInput = z.infer<typeof createPermissionDtlBulkSchema>;

export const updatePermissionDtlSchema = z.object({
  id: z.number().int().positive(),
  enabled: z.boolean().optional(),
  readOnly: z.boolean().optional(),
  modify: z.boolean().optional(),
  delete: z.boolean().optional(),
  insert: z.boolean().optional(),
  print: z.boolean().optional(),
  execute: z.boolean().optional(),
});
export type UpdatePermissionDtlInput = z.infer<typeof updatePermissionDtlSchema>;

export const deletePermissionDtlSchema = z.object({
  id: z.number().int().positive(),
});

export const checkPermissionSchema = z.object({
  resourceId: z.number().int().positive(),
  action: permissionActionSchema.default(PermissionAction.ENABLED),
});
export type CheckPermissionInput = z.infer<typeof checkPermissionSchema>;

/** Throws a ZodError (caller should catch and turn into a 400) if the input is invalid. */
export function validateCreatePermissionDtl(input: unknown): CreatePermissionDtlInput {
  return createPermissionDtlSchema.parse(input);
}

export function validateCreatePermissionDtlBulk(input: unknown): CreatePermissionDtlBulkInput {
  return createPermissionDtlBulkSchema.parse(input);
}

export function validateUpdatePermissionDtl(input: unknown): UpdatePermissionDtlInput {
  return updatePermissionDtlSchema.parse(input);
}

export function validateCheckPermission(input: unknown): CheckPermissionInput {
  return checkPermissionSchema.parse(input);
}
