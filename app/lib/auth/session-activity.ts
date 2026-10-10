import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { isInsertSafe } from '@/lib/db/sequenceGuard';

/**
 * Login-session bookkeeping — ports of CI login.php / user_master_m:
 *   set_last_login_details  → concurrent_login_details row per login (SESSION_ID, IP, platform…)
 *   user_last_login_dtl     → login history row per successful login
 *   get_all_concurrent_device_details → sessions idle ≥ 20 min are marked offline
 *   updateUserLastActive    → heartbeat every 8 minutes (LAST_ACTIVE)
 *   updateIsOnline(0) on logout
 * The session id travels in the access/refresh tokens (`sid`), like CI's my_session_id.
 *
 * Audit inserts are best-effort: while the migrated ID sequences are out of sync they are skipped
 * (and logged) instead of blocking the login — see lib/db/sequenceGuard.ts.
 */

const STALE_AFTER_MINUTES = 20;

export interface LoginMeta {
  ip: string | null;
  userAgent: string | null;
}

export function newSessionId(): string {
  return crypto.randomBytes(20).toString('hex'); // 40 chars = concurrent_login_details.SESSION_ID width
}

/** Marks idle sessions offline and returns how many of the user's sessions are still online. */
export async function countOnlineSessions(userId: number, now = new Date()): Promise<number> {
  const staleBefore = new Date(now.getTime() - STALE_AFTER_MINUTES * 60_000);
  await prisma.concurrent_login_details.updateMany({
    where: { USER_ID: userId, IS_ONLINE: true, LAST_ACTIVE: { lte: staleBefore } },
    data: { IS_ONLINE: false, UPDATED_ON: now },
  });
  return prisma.concurrent_login_details.count({
    where: { USER_ID: userId, IS_ONLINE: true, OR: [{ IS_DELETED: false }, { IS_DELETED: null }] },
  });
}

export async function recordLoginSession(
  user: { userId: number; oaId: number | null; oaBrandId: number | null; isSysAdmin: boolean },
  sid: string,
  meta: LoginMeta,
  now = new Date(),
): Promise<void> {
  const writes: Promise<unknown>[] = [];

  if (await isInsertSafe('concurrent_login_details', 'ID')) {
    writes.push(
      prisma.concurrent_login_details.create({
        data: {
          USER_ID: user.userId,
          SESSION_ID: sid,
          PLATFORM: meta.userAgent?.slice(0, 1000) ?? null,
          LAST_LOGGED_IN: now,
          LAST_LOGGED_IN_IP: meta.ip?.slice(0, 40) ?? null,
          LAST_ACTIVE: now,
          IS_ONLINE: true,
          IS_DELETED: false,
          OA_ID: user.oaId,
          OA_BRAND_ID: user.oaBrandId,
          CREATED_BY: user.userId,
          CREATED_ON: now,
        },
      }),
    );
  } else {
    console.warn('[auth] concurrent_login_details insert skipped: ID sequence out of sync');
  }

  if (await isInsertSafe('user_last_login_dtl', 'USER_LAST_LOGIN_DTL_ID')) {
    writes.push(
      prisma.user_last_login_dtl.create({
        data: {
          USER_ID: user.userId,
          LAST_LOGIN_AT: now,
          LAST_LOGGED_IN_IP: meta.ip?.slice(0, 40) ?? null,
          USER_AGENT: meta.userAgent?.slice(0, 250) ?? null,
          STATUS_MESSAGE: 'Success',
          IS_DELETED: 0,
          OA_ID: user.isSysAdmin ? null : user.oaId,
          OA_BRAND_ID: user.oaBrandId,
          CREATED_BY: user.userId,
          CREATED_ON: now,
        },
      }),
    );
  } else {
    console.warn('[auth] user_last_login_dtl insert skipped: ID sequence out of sync');
  }

  await Promise.all(writes);
}

/** Heartbeat (CI updateUserLastActive): touches this session, or all online sessions of the user. */
export async function touchLastActive(userId: number, sid?: string): Promise<number> {
  const now = new Date();
  const result = await prisma.concurrent_login_details.updateMany({
    where: {
      USER_ID: userId,
      IS_ONLINE: true,
      ...(sid ? { SESSION_ID: sid } : {}),
      OR: [{ IS_DELETED: false }, { IS_DELETED: null }],
    },
    data: { LAST_ACTIVE: now, UPDATED_BY: userId, UPDATED_ON: now },
  });
  return result.count;
}

/** Logout (CI updateIsOnline(0) + updateConcurrentCount(-1)). */
export async function endLoginSession(userId: number, sid?: string): Promise<void> {
  const now = new Date();
  if (sid) {
    await prisma.concurrent_login_details.updateMany({
      where: { USER_ID: userId, SESSION_ID: sid },
      data: { IS_ONLINE: false, UPDATED_ON: now },
    });
  }
  const online = await countOnlineSessions(userId, now);
  await prisma.user_mst.updateMany({
    where: { USER_ID: userId },
    data: { IS_ONLINE: online > 0, CONCURRENT_LOGIN_COUNT: online },
  });
}
