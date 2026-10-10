import { prisma } from '@/lib/prisma';
import { ValidationError } from '@/lib/http/errors';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { hashPassword } from '@/lib/auth/password';
import { validatePasswordReuse, validatePasswordRules } from '@/lib/auth/credentialPolicy';
import { USER_STATUS, userStatusId } from '@/lib/auth/userStatus';

/**
 * The single "set a user's password" operation used by reset, change and admin flows.
 * CI rule 20: every password set writes history, updates PASSWORD_CHANGED_TIME and makes the
 * account Active (this also clears Locked / Password Expired). CI's change-password skipped the
 * last two, which broke its own expiry and grace-period logic.
 */
export async function assertPasswordAllowed(
  password: string,
  user: { userId: number; oaBrandId: number | null },
  field = 'password',
): Promise<void> {
  const errors = [
    ...(await validatePasswordRules(password, user.oaBrandId)),
    ...(await validatePasswordReuse(password, user.userId, user.oaBrandId)),
  ];
  if (errors.length) throw new ValidationError(errors[0], { [field]: errors });
}

export async function setUserPassword(
  userId: number,
  password: string,
  opts: { actorId: number; resetFailedAttempts?: boolean },
): Promise<void> {
  const user = await prisma.user_mst.findFirst({
    where: { USER_ID: userId },
    select: { USER_ID: true, OA_ID: true, OA_BRAND_ID: true },
  });
  if (!user) throw new ValidationError('User not found.');

  await assertInsertSafe('user_password_history', 'ID');
  const [hash, activeId] = await Promise.all([hashPassword(password), userStatusId(USER_STATUS.ACTIVE)]);
  const now = new Date();

  await prisma.$transaction([
    prisma.user_mst.updateMany({
      where: { USER_ID: userId },
      data: {
        PASSWORD: hash,
        PASSWORD_CHANGED_TIME: now,
        USER_STATUS_ID: activeId,
        PWD_RESET_CD: null,
        UPDATED_BY: opts.actorId,
        UPDATED_ON: now,
        ...(opts.resetFailedAttempts ? { FAILED_LOGIN_ATTEMPTS: 0, LAST_FAILED_ATTEMPT_ON: null } : {}),
      },
    }),
    prisma.user_password_history.create({
      data: {
        USER_ID: userId,
        PASSWORD: hash,
        OA_ID: user.OA_ID ?? 0,
        OA_BRAND_ID: user.OA_BRAND_ID ?? 0,
        CREATED_BY: opts.actorId,
        UPDATED_BY: opts.actorId,
        CREATED_ON: now,
        UPDATED_ON: now,
      },
    }),
  ]);
}
