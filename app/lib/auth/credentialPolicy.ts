import { prisma } from '@/lib/prisma';
import { isYes, minutesSince, periodToMinutes, settingService, toNumber } from '@/lib/settings/settingService';
import { verifyPassword } from '@/lib/auth/password';

/**
 * Brand password / username policy — CI passwordValidation() / usernameValidation() and the
 * reuse callbacks (login/forgot_pass.php, user/changepassword.php, user/user_master.php,
 * login/user_registration_c.php), consolidated. CI implemented these rules four slightly different
 * ways (inverted keyword polarity in registration, inverted reuse semantics between reset and
 * change); one consistent implementation is used everywhere here.
 *
 * Settings (independent_mst codes, per brand):
 *   SGNPSR  password: SSAMNOCFP min length, SSAPCD digit, SSAPCC uppercase, SSAPCL lowercase, SSAKAFP keyword
 *   SGNPUHR reuse:    SSAPRA reuse allowed, SSAPRT/SSAPRTF reuse wait, SSAPRM max reuse count
 *   SGNUNR  username: SSAMCU min length, SSAUCD digit, SSAUCC uppercase, SSAUCLC lowercase, SSAKAU keyword
 */

/** CI's hard-coded keyword list (+ every brand name, lower-cased). */
const KEYWORDS = ['admin', 'administrator', 'manager', 'employee', 'payroll', 'superuser', 'password', '12345', 'qwerty'];
const DEFAULT_PASSWORD_MIN = 5; // CI forgot_pass default when SSAMNOCFP is empty
const USERNAME_MAX = 20;
/** Only the most recent history entries are compared (bounded cost; CI compared the whole history). */
const HISTORY_LIMIT = 24;

async function isKeyword(value: string): Promise<boolean> {
  const v = value.trim().toLowerCase();
  if (KEYWORDS.includes(v)) return true;
  const brand = await prisma.oa_brands.findFirst({
    where: { OA_BRAND_NM: { equals: value.trim(), mode: 'insensitive' } },
    select: { OA_BRAND_ID: true },
  });
  return !!brand;
}

export async function validatePasswordRules(password: string, oaBrandId: number | null): Promise<string[]> {
  const rules = oaBrandId ? await settingService.getGroupValues(oaBrandId, ['SGNPSR']) : {};
  const errors: string[] = [];
  const min = toNumber(rules.SSAMNOCFP) || DEFAULT_PASSWORD_MIN;
  if (password.length < min) errors.push(`Password must be at least ${min} characters.`);
  if (isYes(rules.SSAPCD) && !/[0-9]/.test(password)) errors.push('Password should have atleast one number');
  if (isYes(rules.SSAPCC) && !/[A-Z]/.test(password)) errors.push('Password should have atleast one uppercase character');
  if (isYes(rules.SSAPCL) && !/[a-z]/.test(password)) errors.push('Password should have atleast one lowercase character');
  if (isYes(rules.SSAKAFP) && (await isKeyword(password))) errors.push('Password cannot be a keyword');
  return errors;
}

/**
 * Reuse rule (SGNPUHR). SSAPRA = No → a password used before can never be reused.
 * SSAPRA = Yes → reuse allowed unless used ≥ SSAPRM times (unset = unlimited) or last used within
 * SSAPRT × SSAPRTF. (CI applied these with contradictory meanings in reset vs change.)
 */
export async function validatePasswordReuse(password: string, userId: number, oaBrandId: number | null): Promise<string[]> {
  const rules = oaBrandId ? await settingService.getGroupValues(oaBrandId, ['SGNPUHR']) : {};
  const history = await prisma.user_password_history.findMany({
    where: { USER_ID: userId },
    orderBy: { CREATED_ON: 'desc' },
    take: HISTORY_LIMIT,
    select: { PASSWORD: true, CREATED_ON: true },
  });
  const matches: Date[] = [];
  for (const h of history) {
    if ((await verifyPassword(password, h.PASSWORD)).valid) matches.push(h.CREATED_ON);
  }
  if (!matches.length) return [];

  if (rules.SSAPRA !== null && rules.SSAPRA !== undefined && !isYes(rules.SSAPRA)) return ['Password cannot be a reused'];
  const maxReuse = toNumber(rules.SSAPRM);
  if (maxReuse > 0 && matches.length >= maxReuse) return ['Password Maximum Reuse Limit Exceeded'];
  const wait = periodToMinutes(rules.SSAPRT, rules.SSAPRTF);
  if (wait > 0 && minutesSince(matches[0]) <= wait) return ['Password cannot be a reused at this time'];
  return [];
}

export async function validateUsernameRules(
  username: string,
  oaBrandId: number | null,
  opts: { exceptUserId?: number } = {},
): Promise<string[]> {
  const rules = oaBrandId ? await settingService.getGroupValues(oaBrandId, ['SGNUNR']) : {};
  const value = username.trim();
  const errors: string[] = [];
  const min = toNumber(rules.SSAMCU);
  if (!value) errors.push('Username is required.');
  if (value.length > USERNAME_MAX) errors.push(`Username must be at most ${USERNAME_MAX} characters.`);
  if (min && value.length < min) errors.push(`Username must be at least ${min} characters.`);
  if (isYes(rules.SSAUCD) && !/[0-9]/.test(value)) errors.push('Username should have atleast one number');
  if (isYes(rules.SSAUCC) && !/[A-Z]/.test(value)) errors.push('Username should have atleast one uppercase character');
  if (isYes(rules.SSAUCLC) && !/[a-z]/.test(value)) errors.push('Username should have atleast one lowercase character');
  if (isYes(rules.SSAKAU) && (await isKeyword(value))) errors.push('Username should cannot be a keyword');

  const clash = await prisma.user_mst.findFirst({
    where: {
      USER_NAME: { equals: value, mode: 'insensitive' },
      OR: [{ IS_DELETED: false }, { IS_DELETED: null }],
      ...(opts.exceptUserId ? { NOT: { USER_ID: opts.exceptUserId } } : {}),
    },
    select: { USER_ID: true },
  });
  if (clash) errors.push('Username already exists');
  return errors;
}
