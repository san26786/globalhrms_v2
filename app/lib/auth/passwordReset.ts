import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { BusinessRuleError, NotFoundError } from '@/lib/http/errors';
import { createEmailLayout, sendEmail } from '@/lib/notification/email';
import { assertPasswordAllowed, setUserPassword } from '@/lib/auth/passwordService';

/**
 * Password recovery — CI login/forgot_pass (+ user_master::sendPasswordMail) and
 * login/forgot_username, redesigned for safety:
 *  - the reset link carries a random single-use token; only its SHA-256 hash and expiry are stored
 *    (user_mst.PWD_RESET_CD = "<hash>:<expiresAtMs>"). CI's link was base64(USER_ID): anyone could
 *    reset any account;
 *  - responses never reveal whether an email/username exists;
 *  - forgot-username requires the memorable word / passcode of THAT account (CI accepted any user's);
 *  - all interpolated values are HTML-escaped.
 * Setting the new password goes through setUserPassword (policy, history, status Active).
 */

const TOKEN_TTL_MINUTES = 60;

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Absolute base URL for links in emails — from configuration, never from the request's Host header. */
export function appBaseUrl(fallbackOrigin: string): string {
  const configured = process.env.APP_URL?.replace(/\/+$/, '');
  if (configured) return configured;
  if (process.env.NODE_ENV !== 'production') return fallbackOrigin;
  throw new BusinessRuleError('Password reset is not available: APP_URL is not configured.', 'NOT_CONFIGURED');
}

async function findActiveUserByEmail(email: string) {
  return prisma.user_mst.findFirst({
    where: { REG_EMAIL_ID: { equals: email.trim(), mode: 'insensitive' }, OR: [{ IS_DELETED: false }, { IS_DELETED: null }] },
    orderBy: { USER_ID: 'asc' },
    select: { USER_ID: true, USER_NAME: true, REG_EMAIL_ID: true, OA_BRAND_ID: true, MEMORABLE_WORD: true, TPIN: true },
  });
}

async function issueToken(userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + TOKEN_TTL_MINUTES * 60_000;
  await prisma.user_mst.updateMany({ where: { USER_ID: userId }, data: { PWD_RESET_CD: `${sha256(token)}:${expiresAt}` } });
  return token;
}

async function sendResetMail(user: { USER_NAME: string; REG_EMAIL_ID: string }, token: string, baseUrl: string) {
  const link = `${baseUrl}/login/forgot_pass/reset_pass/${token}`;
  const html = createEmailLayout(
    `<p>Dear ${escapeHtml(user.USER_NAME)},</p>
     <p>You have recently requested to reset your password for your Global HR account. Click the link below to choose a new password. The link is valid for ${TOKEN_TTL_MINUTES} minutes and can be used once.</p>
     <p><a href="${escapeHtml(link)}">Reset your password</a></p>
     <p>If you did not request a password reset, please ignore this email.</p>
     <p>Thank you,<br/>Support Team</p>`,
    'Password Reset',
  );
  return sendEmail({ to: user.REG_EMAIL_ID, subject: 'Password Reset', html });
}

export const passwordResetService = {
  /** Public "forgot password": always resolves the same way whether or not the email exists. */
  async requestReset(email: string, baseUrl: string): Promise<void> {
    const user = await findActiveUserByEmail(email);
    if (!user) return;
    const token = await issueToken(user.USER_ID);
    const sent = await sendResetMail(user, token, baseUrl);
    if (!sent.success) console.error('[auth] password reset email not sent:', sent.error);
  },

  /** Admin "Send Password Reset Mail" (CI user_master::sendPasswordMail). */
  async issuePasswordReset(userId: number, baseUrl: string): Promise<{ email: string }> {
    const user = await prisma.user_mst.findFirst({
      where: { USER_ID: userId, OR: [{ IS_DELETED: false }, { IS_DELETED: null }] },
      select: { USER_ID: true, USER_NAME: true, REG_EMAIL_ID: true },
    });
    if (!user) throw new NotFoundError('User not found.');
    const token = await issueToken(user.USER_ID);
    const sent = await sendResetMail(user, token, baseUrl);
    if (!sent.success) throw new BusinessRuleError('The password reset email could not be sent.', 'EMAIL_FAILED');
    return { email: user.REG_EMAIL_ID };
  },

  /** Is the token valid (for showing the reset form)? */
  async isTokenValid(token: string): Promise<boolean> {
    return (await this.findUserByToken(token)) !== null;
  },

  async findUserByToken(token: string) {
    const user = await prisma.user_mst.findFirst({
      where: { PWD_RESET_CD: { startsWith: `${sha256(token)}:` } },
      select: { USER_ID: true, OA_BRAND_ID: true, PWD_RESET_CD: true },
    });
    const expiresAt = Number(user?.PWD_RESET_CD?.split(':')[1]);
    if (!user || !Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;
    return user;
  },

  /** CI forgot_pass/changepass — policy-checked; the token is consumed (setUserPassword clears it). */
  async resetPassword(token: string, password: string): Promise<void> {
    const user = await this.findUserByToken(token);
    if (!user) throw new BusinessRuleError('This password reset link is invalid or has expired.', 'INVALID_TOKEN');
    await assertPasswordAllowed(password, { userId: user.USER_ID, oaBrandId: user.OA_BRAND_ID });
    await setUserPassword(user.USER_ID, password, { actorId: user.USER_ID, resetFailedAttempts: true });
  },

  /** CI forgot_username: email + memorable word (or passcode) of the same account → username by email. */
  async remindUsername(email: string, memorableWordOrPin: string): Promise<void> {
    const user = await findActiveUserByEmail(email);
    if (!user) return;
    const secret = memorableWordOrPin.trim();
    const wordMatches = !!user.MEMORABLE_WORD && user.MEMORABLE_WORD.trim().toUpperCase() === secret.toUpperCase();
    const pinMatches = user.TPIN !== null && /^\d{1,9}$/.test(secret) && Number(secret) === user.TPIN;
    if (!wordMatches && !pinMatches) return;
    const html = createEmailLayout(
      `<p>Your username is <strong>${escapeHtml(user.USER_NAME)}</strong>.</p><p>Thank you,<br/>Support Team</p>`,
      'Forgot Username',
    );
    const sent = await sendEmail({ to: user.REG_EMAIL_ID, subject: 'Forgot Username', html });
    if (!sent.success) console.error('[auth] username reminder not sent:', sent.error);
  },
};

/** Admin 'Send Password Reset Mail' entry point: issuePasswordReset(userId, baseUrl). */
export const issuePasswordReset = (userId: number, baseUrl: string) => passwordResetService.issuePasswordReset(userId, baseUrl);
