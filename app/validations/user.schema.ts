import { z } from 'zod';

/**
 * User administration input schemas — CI form_validation rules of controllers/user/* and
 * controllers/authoritylevel/authoritylevel.php. Server-side validation is authoritative; the
 * forms show the returned field errors. Database-backed rules (uniqueness, username/password
 * policy, "belongs to your scope") live in the services (app/lib/user/*).
 */

const blankToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);
const trimmed = (max: number) => z.string().trim().max(max, `Must be at most ${max} characters.`);
const requiredText = (max: number, label: string) => trimmed(max).min(1, `${label} is required.`);
const optionalText = (max: number) =>
  z.preprocess(
    blankToUndefined,
    trimmed(max)
      .optional()
      .transform((v) => (v ? v : null)),
  );
const requiredId = (label: string) =>
  z.coerce.number({ message: `${label} is required.` }).int(`${label} is required.`).positive(`${label} is required.`);
const optionalId = z.preprocess(blankToUndefined, z.coerce.number().int().positive().optional());
/** Sysadmin only (CI OrgDetailsView): create the record for another brand. Ignored for everyone else. */
const oaBrandId = optionalId;

/** Multi-select ids: coerced, de-duplicated. */
const idList = (label: string, min: number) =>
  z
    .array(z.coerce.number().int().positive(), { message: `${label} is required.` })
    .max(1000, `At most 1000 ${label.toLowerCase()} can be selected.`)
    .transform((ids) => [...new Set(ids)])
    .refine((ids) => ids.length >= min, `${label} is required.`);

// ------------------------------------------------------------------ user_master

const email = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim() : v),
  z.email('Reg Email must contain a valid email address.').max(100, 'Reg Email must be at most 100 characters.'),
);
/** CI tPin: required|integer|exact_length[6]. Stored in user_mst.TPIN (integer column). */
const tPin = z.preprocess(
  (v) => (typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : v),
  z.string({ message: 'TPin is required.' }).regex(/^[0-9]{6}$/, 'TPin must be exactly 6 digits.'),
);
/** CI memorableWord: required; stored upper-case. */
const memorableWord = requiredText(250, 'Memorable Word').transform((v) => v.toUpperCase());

const userMasterBase = {
  /** Length/character rules come from the brand policy (validateUsernameRules). */
  userName: requiredText(40, 'User Name'),
  regEmail: email,
  extRefId: optionalText(40),
  domainId: requiredId('User Domain'),
  isAdmin: z.boolean().default(false),
  /** CI RoleID[] (multi-select "Primary Role"), required. */
  roleIds: idList('Primary Role', 1),
  userTypeId: optionalId,
};

export const userMasterCreateSchema = z.object({
  ...userMasterBase,
  password: z.string({ message: 'Password is required.' }).min(1, 'Password is required.').max(100),
  tPin,
  memorableWord,
});
export type UserMasterCreateInput = z.infer<typeof userMasterCreateSchema>;

/** Edit: password / TPin / memorable word are secrets — blank means "unchanged". */
export const userMasterUpdateSchema = z.object({
  ...userMasterBase,
  password: z.preprocess(blankToUndefined, z.string().max(100).optional()),
  tPin: z.preprocess(blankToUndefined, tPin.optional()),
  memorableWord: z.preprocess(blankToUndefined, memorableWord.optional()),
  /** CI "activation" checkbox (shown while ACTIVATION is set): clears the activation token. */
  activate: z.boolean().default(false),
});
export type UserMasterUpdateInput = z.infer<typeof userMasterUpdateSchema>;

export const USER_STATUS_ACTIONS = ['activate', 'deactivate', 'activate-suspended'] as const;
export type UserStatusAction = (typeof USER_STATUS_ACTIONS)[number];

/** CI user_change_status/{USA|USD}, user_suspend_status (delCheckbox[] = ids). */
export const userStatusActionSchema = z.object({
  action: z.enum(USER_STATUS_ACTIONS, { message: 'Unknown action.' }),
  ids: z
    .array(z.coerce.number().int().positive(), { message: 'Select at least one user.' })
    .min(1, 'Select at least one user.')
    .max(500, 'At most 500 users can be changed at once.')
    .transform((ids) => [...new Set(ids)]),
});
export type UserStatusActionInput = z.infer<typeof userStatusActionSchema>;

// ------------------------------------------------------------------ user_domain

/** CI user_domain: UserDmnName required (+ unique per brand), Dscrptn trim. */
export const userDomainSchema = z.object({
  name: requiredText(40, 'Domain Name'),
  description: optionalText(100),
  oaBrandId,
});
export type UserDomainInput = z.infer<typeof userDomainSchema>;

// ------------------------------------------------------------------ role_master

/**
 * CI role_master: RoleName required|max_length[50] (+ unique per domain), Description
 * required|max_length[50], UserDmnId required|integer, auth_level required|integer.
 * ROLE_NM is VARCHAR(40) in the database, so 40 is enforced (CI's 50 would fail on insert).
 */
export const roleMasterSchema = z.object({
  roleName: requiredText(40, 'Role Name'),
  description: requiredText(50, 'Role Description'),
  authorityLevel: z.preprocess(
    blankToUndefined,
    z.coerce.number({ message: 'Authority Level is required.' }).int('Authority Level must be a whole number.'),
  ),
  domainId: requiredId('Domain Name'),
  isAdminRole: z.boolean().default(false),
  isAssignable: z.boolean().default(true),
  oaBrandId,
});
export type RoleMasterInput = z.infer<typeof roleMasterSchema>;

// ------------------------------------------------------------------ user_role

/** CI user_role: RoleID required|integer (+ unique per user); the user comes from the tab (users/{id}). */
export const userRoleSchema = z.object({
  userId: requiredId('User'),
  roleId: requiredId('Role'),
});
export type UserRoleInput = z.infer<typeof userRoleSchema>;

// ------------------------------------------------------------------ user_group

/** CI user_group: UserGrpNm required (+ unique per domain), UserDmnID required|integer, user_name[] required. */
export const userGroupSchema = z.object({
  name: requiredText(40, 'User Group'),
  domainId: requiredId('Domain'),
  memberIds: idList('Select Users', 1),
});
export type UserGroupInput = z.infer<typeof userGroupSchema>;

// ------------------------------------------------------------------ user_group_role

/** CI user_group_role: RoleID required|integer, UserGroupID required (+ unique group/role). */
export const userGroupRoleSchema = z.object({
  groupId: requiredId('User Group'),
  roleId: requiredId('Role'),
  oaBrandId,
});
export type UserGroupRoleInput = z.infer<typeof userGroupRoleSchema>;

// ------------------------------------------------------------------ authoritylevel

/** CI authoritylevel: Authority_id required (master of type 40), Authority_value required. */
export const authorityLevelSchema = z.object({
  authorityLevelId: requiredId('Authority Level'),
  value: requiredText(250, 'Authority Value'),
  oaBrandId,
});
export type AuthorityLevelInput = z.infer<typeof authorityLevelSchema>;

// ------------------------------------------------------------------ user_type_role_mapping

/** CI user_type_role_mapping: AppID, UserTypeID, RoleID, PermissionClassID all required|integer. */
export const userTypeRoleMappingSchema = z.object({
  appId: requiredId('Application'),
  userTypeId: requiredId('User Type'),
  roleId: requiredId('Role'),
  permissionClassId: requiredId('Permission Class'),
});
export type UserTypeRoleMappingInput = z.infer<typeof userTypeRoleMappingSchema>;
