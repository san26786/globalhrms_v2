import { z } from 'zod';

/**
 * Permission Class (CI user/permission_dtl::setFormValidationRules + the form's submit script).
 * Organisation / brand / user are required only for admins (is_admin != 0) — that rule needs the
 * caller's level, so the service applies it (permissionClassService.save).
 */

const blankToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);
const optionalId = z.preprocess(blankToUndefined, z.coerce.number().int().positive().optional());

/** Multi-select ids: coerced, de-duplicated. */
const idList = (label: string) =>
  z
    .array(z.coerce.number().int().positive())
    .max(2000, `At most 2000 ${label} can be selected.`)
    .default([])
    .transform((ids) => [...new Set(ids)]);

const flag = z.boolean().default(false);

/** One relationship_dtl node of the Function tab (CI module[] + enabled/readonly/modify/delete/insert). */
export const functionGrantSchema = z.object({
  relDetId: z.coerce.number().int().positive(),
  enabled: flag,
  readonly: flag,
  modify: flag,
  delete: flag,
  insert: flag,
});

export const permissionClassSaveSchema = z.object({
  /** CI permission_class: trim|required|alphaWithSpaces. */
  permissionClassName: z
    .string({ message: 'Permission Class Field is required.' })
    .trim()
    .min(1, 'Permission Class Field is required.')
    .max(100, 'Permission Class must be at most 100 characters.')
    .regex(/^[A-Za-z ]+$/, 'Permission Class may only contain letters and spaces.'),
  /** CI permission_class_ID: set when an existing class was picked (edit). */
  permissionClassId: optionalId,
  /** CI OaId / OaBrandID / user ("Requested By") — required for admins. */
  oaId: optionalId,
  oaBrandId: optionalId,
  userId: optionalId,
  /** CI permissions[] ("Access Write"): SYSTEMPERMISSIONTYPE master ids. */
  accessPermissions: idList('access permissions'),
  users: idList('users'),
  userGroups: idList('user groups'),
  roles: idList('roles'),
  functions: z.array(functionGrantSchema).max(10000, 'Too many functions.').default([]),
});

export type PermissionClassSaveInput = z.infer<typeof permissionClassSaveSchema>;
export type FunctionGrantInput = z.infer<typeof functionGrantSchema>;
