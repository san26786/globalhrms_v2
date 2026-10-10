import {
  findLastLoginAt,
  findOrgStatusId,
  findUserForLogin,
  markLoginFailure,
  markLoginSuccess,
  setUserStatus,
  type LoginUserRow,
} from "./auth-repository";
import { hashPassword, verifyPassword } from "./password";
import { USER_STATUS, userStatusCode, userStatusId } from "./userStatus";
import { countOnlineSessions, newSessionId, recordLoginSession, type LoginMeta } from "./session-activity";
import { getMasterId } from "@/lib/masters/masterService";
import { isYes, minutesSince, periodToMinutes, settingService, toNumber } from "@/lib/settings/settingService";

/**
 * Login — port of CI controllers/login/login.php::setFormControls().
 *
 * Brand login policy (setting groups SGNALR, SGNULPRS, SGNPAER, SEAS, SEAL for the user's brand):
 *   SSAFLA / SSAPLT·SSAPLTF   lock after N failed attempts for a time          (status USL)
 *   SSANOCLA / SSAACL          max concurrent sessions / allow concurrent login
 *   SSAIASP·SSAICSPF           suspend accounts never used within a period       (status USI)
 *   SSAPEP·SSAPEF              password expiry                                   (status USPE)
 *   SSAPGT·SSAPGTF             first-login grace period → forced password change
 *   SSALP·SSALF                idle auto-logout
 * The system administrator (IS_SYSADMIN) is exempt from the policy, as in CI.
 *
 * Deliberate differences from CI (security):
 *  - account status/activation/organisation are checked only AFTER a valid password, so the
 *    login form cannot be used to discover which usernames exist or what state they are in;
 *  - the lock is evaluated before the password check and every failure counts (CI evaluated it only
 *    for correct passwords, with a sliding window);
 *  - legacy MD5 hashes are upgraded to bcrypt on successful login;
 *  - the inactivity suspension really sets the status (a CI bug left it unchanged);
 *  - "Day" is 1440 minutes (CI used 1400).
 */

const LOGIN_POLICY_GROUPS = ["SGNALR", "SGNULPRS", "SGNPAER", "SEAS", "SEAL"];

/** A real bcrypt hash, so an unknown username costs the same time as a wrong password. */
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword("globalhrms-timing-equaliser"));

export const LOGIN_MESSAGES = {
  invalid: "Login UnSuccessful. Please check your login credentials....",
  notActive: "Login UnSuccessful. Your Account Is Not Active.",
  deactivated: "Login UnSuccessful. Your Account Is Being Deactivated.",
  alreadyLoggedIn: "Login UnSuccessful. You are already logged in on other device.",
  suspended: "Login UnSuccessful. Your Account has been suspended due to no login after activation.",
  expired: "Login UnSuccessful. Your password has expired. Please reset it using Forgot Password.",
  resetNow: "Please reset your password.",
  resetSoon: "Please reset your password soon.",
} as const;

export interface AuthenticatedUser {
  id: string;
  userId: number;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isAdmin: boolean;
  isSysAdmin: boolean;
  oaId: number | null;
  oaBrandId: number | null;
  sid: string;
  /** Previous LAST_LOGIN_AT (CI session lastLoginAt). */
  previousLoginAt: string | null;
  /** First login: the user has never set security questions (CI then redirects to them after the password change). */
  needsSecurityQuestions: boolean;
  autoLogoutMs: number;
}

export type LoginResult =
  | { ok: true; user: AuthenticatedUser; forcePasswordChange: boolean; notice: string | null }
  | { ok: false; code: "INVALID" | "LOCKED" | "NOT_ACTIVE" | "DEACTIVATED" | "CONCURRENT" | "SUSPENDED" | "EXPIRED"; message: string };

function fail(code: Exclude<LoginResult, { ok: true }>["code"], message: string): LoginResult {
  return { ok: false, code, message };
}

export async function authenticateUser(usernameOrEmail: string, password: string, meta: LoginMeta): Promise<LoginResult> {
  const now = new Date();
  const user = await findUserForLogin(usernameOrEmail);
  if (!user) {
    await verifyPassword(password, await getDummyHash());
    return fail("INVALID", LOGIN_MESSAGES.invalid);
  }

  const isSysAdmin = !!user.IS_SYSADMIN;
  const rules = !isSysAdmin && user.OA_BRAND_ID ? await settingService.getGroupValues(user.OA_BRAND_ID, LOGIN_POLICY_GROUPS) : {};

  // 1. Lock (SGNALR) — before the password is even checked.
  const maxAttempts = toNumber(rules.SSAFLA);
  const lockMinutes = periodToMinutes(rules.SSAPLT, rules.SSAPLTF);
  const lockedMessage = `Your Account is Locked. Please check your login credentials and try after ${rules.SSAPLT ?? ""} ${rules.SSAPLTF ?? ""}`.trim();
  if (!isSysAdmin && maxAttempts > 0 && user.FAILED_LOGIN_ATTEMPTS >= maxAttempts && minutesSince(user.LAST_FAILED_ATTEMPT_ON, now) <= lockMinutes) {
    return fail("LOCKED", lockedMessage);
  }

  // 2. Credentials.
  const check = await verifyPassword(password, user.PASSWORD);
  if (!check.valid) {
    await markLoginFailure(user.USER_ID, now);
    if (!isSysAdmin && maxAttempts > 0 && user.FAILED_LOGIN_ATTEMPTS + 1 >= maxAttempts) {
      await setUserStatus(user.USER_ID, await userStatusId(USER_STATUS.LOCKED));
      return fail("LOCKED", lockedMessage);
    }
    return fail("INVALID", LOGIN_MESSAGES.invalid);
  }

  // 3. Account state (only revealed to someone who knows the password).
  const status = await userStatusCode(user.USER_STATUS_ID);
  if (status === USER_STATUS.INACTIVE || status === USER_STATUS.PENDING_ACTIVATION || user.ACTIVATION) {
    return fail("NOT_ACTIVE", LOGIN_MESSAGES.notActive);
  }
  if (status === USER_STATUS.DEACTIVATED) return fail("DEACTIVATED", LOGIN_MESSAGES.deactivated);
  if (!isSysAdmin) {
    const [orgStatus, activeOrg] = await Promise.all([findOrgStatusId(user.OA_ID), getMasterId("OASA")]);
    if (!orgStatus || orgStatus !== activeOrg) return fail("NOT_ACTIVE", LOGIN_MESSAGES.notActive);
  }

  const lastLoginAt = await findLastLoginAt(user.USER_ID);
  const neverLoggedIn = lastLoginAt === null;
  const passwordSetAt = user.PASSWORD_CHANGED_TIME ?? user.CREATED_ON ?? null;
  let forcePasswordChange = false;
  let notice: string | null = null;

  if (!isSysAdmin) {
    const policy = await evaluatePolicy(user, rules, { now, neverLoggedIn, passwordSetAt });
    if (!policy.ok) return policy.result;
    forcePasswordChange = policy.forcePasswordChange;
    notice = policy.notice;
  }

  // 4. Success.
  const sid = newSessionId();
  const online = await countOnlineSessions(user.USER_ID, now);
  await markLoginSuccess(user.USER_ID, {
    now,
    onlineSessions: online + 1,
    statusId: status === USER_STATUS.LOCKED ? await userStatusId(USER_STATUS.ACTIVE) : undefined,
    newPasswordHash: check.needsRehash ? await hashPassword(password) : undefined,
  });
  await recordLoginSession(
    { userId: user.USER_ID, oaId: user.OA_ID, oaBrandId: user.OA_BRAND_ID, isSysAdmin },
    sid,
    meta,
    now,
  );

  return {
    ok: true,
    forcePasswordChange,
    notice,
    user: {
      id: String(user.USER_ID),
      userId: user.USER_ID,
      username: user.USER_NAME,
      email: user.REG_EMAIL_ID,
      firstName: user.FIRST_NAME,
      lastName: user.LAST_NAME,
      isAdmin: !!user.IS_ADMIN,
      isSysAdmin,
      oaId: user.OA_ID,
      oaBrandId: user.OA_BRAND_ID,
      sid,
      previousLoginAt: lastLoginAt?.toISOString() ?? null,
      needsSecurityQuestions: !user.QUESTION_ONE,
      autoLogoutMs: isSysAdmin ? 0 : periodToMinutes(rules.SSALP, rules.SSALF) * 60_000,
    },
  };
}

type PolicyOutcome =
  | { ok: true; forcePasswordChange: boolean; notice: string | null }
  | { ok: false; result: LoginResult };

async function evaluatePolicy(
  user: LoginUserRow,
  rules: Record<string, string | null>,
  ctx: { now: Date; neverLoggedIn: boolean; passwordSetAt: Date | null },
): Promise<PolicyOutcome> {
  // Concurrent sessions (SGNULPRS).
  const maxSessions = toNumber(rules.SSANOCLA);
  if (maxSessions > 0) {
    const online = await countOnlineSessions(user.USER_ID, ctx.now);
    if (rules.SSAACL !== null && rules.SSAACL !== undefined && !isYes(rules.SSAACL) && online >= 1) {
      return { ok: false, result: fail("CONCURRENT", LOGIN_MESSAGES.alreadyLoggedIn) };
    }
    if (online >= maxSessions) {
      return {
        ok: false,
        result: fail("CONCURRENT", `Login UnSuccessful. You can be simultaneously logged in on ${maxSessions} devices only.`),
      };
    }
  }

  // Suspension of accounts never used after activation (SGNULPRS).
  const suspendAfter = periodToMinutes(rules.SSAIASP, rules.SSAICSPF);
  if (suspendAfter > 0 && ctx.neverLoggedIn && user.CREATED_ON && minutesSince(user.CREATED_ON, ctx.now) >= suspendAfter) {
    await setUserStatus(user.USER_ID, await userStatusId(USER_STATUS.INACTIVE));
    return { ok: false, result: fail("SUSPENDED", LOGIN_MESSAGES.suspended) };
  }

  // Password expiry (SGNPAER).
  const expiresAfter = periodToMinutes(rules.SSAPEP, rules.SSAPEF);
  if (expiresAfter > 0 && ctx.passwordSetAt && minutesSince(ctx.passwordSetAt, ctx.now) >= expiresAfter) {
    await setUserStatus(user.USER_ID, await userStatusId(USER_STATUS.PASSWORD_EXPIRED));
    return { ok: false, result: fail("EXPIRED", LOGIN_MESSAGES.expired) };
  }

  // First-login grace period (SGNPAER): CI forces non-admins to change the password.
  if (ctx.neverLoggedIn) {
    const grace = periodToMinutes(rules.SSAPGT, rules.SSAPGTF);
    const elapsed = minutesSince(ctx.passwordSetAt, ctx.now);
    if (grace === 0 || elapsed >= grace) {
      return { ok: true, forcePasswordChange: !user.IS_ADMIN, notice: LOGIN_MESSAGES.resetNow };
    }
    return { ok: true, forcePasswordChange: false, notice: LOGIN_MESSAGES.resetSoon };
  }
  return { ok: true, forcePasswordChange: false, notice: null };
}
