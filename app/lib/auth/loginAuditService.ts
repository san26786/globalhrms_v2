import { prisma } from '@/lib/prisma';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { countOnlineSessions } from '@/lib/auth/session-activity';

/**
 * Login audit screens:
 *   CI user/login_attempts             → the caller's own login history (user_last_login_dtl)
 *   CI user/login_attempts/activeSessions → the caller's own online sessions (concurrent_login_details)
 *   CI user/login_details              → online users (sysadmin all, admin own brand, user self)
 */
const HISTORY_LIMIT = 50;

export const loginAuditService = {
  async myLoginHistory(subject: RequestSubject) {
    const rows = await prisma.user_last_login_dtl.findMany({
      where: { USER_ID: subject.userId, IS_DELETED: 0 },
      orderBy: { LAST_LOGIN_AT: 'desc' },
      take: HISTORY_LIMIT,
      select: {
        USER_LAST_LOGIN_DTL_ID: true,
        LAST_LOGIN_AT: true,
        LAST_LOGGED_IN_IP: true,
        APPRO_LOCATION: true,
        USER_AGENT: true,
        STATUS_MESSAGE: true,
      },
    });
    return rows.map((r) => ({
      id: r.USER_LAST_LOGIN_DTL_ID,
      at: r.LAST_LOGIN_AT.toISOString(),
      ip: r.LAST_LOGGED_IN_IP,
      location: r.APPRO_LOCATION,
      userAgent: r.USER_AGENT,
      status: r.STATUS_MESSAGE ?? 'Success',
    }));
  },

  async myActiveSessions(subject: RequestSubject, currentSid?: string) {
    await countOnlineSessions(subject.userId); // expire idle sessions first (CI 20-minute rule)
    const rows = await prisma.concurrent_login_details.findMany({
      where: { USER_ID: subject.userId, IS_ONLINE: true, OR: [{ IS_DELETED: false }, { IS_DELETED: null }] },
      orderBy: { LAST_LOGGED_IN: 'desc' },
      select: { ID: true, SESSION_ID: true, PLATFORM: true, LAST_LOGGED_IN: true, LAST_ACTIVE: true, LAST_LOGGED_IN_IP: true, APPRO_LOCATION: true },
    });
    return rows.map((r) => ({
      id: r.ID,
      isCurrent: !!currentSid && r.SESSION_ID === currentSid,
      userAgent: r.PLATFORM,
      loggedInAt: r.LAST_LOGGED_IN.toISOString(),
      lastActiveAt: r.LAST_ACTIVE.toISOString(),
      ip: r.LAST_LOGGED_IN_IP,
      location: r.APPRO_LOCATION,
    }));
  },

  async onlineUsers(subject: RequestSubject) {
    const scope =
      subject.adminLevel === 2
        ? {}
        : subject.adminLevel === 1
          ? { OA_BRAND_ID: subject.oaBrandId ?? -1 }
          : { USER_ID: subject.userId };
    const rows = await prisma.user_mst.findMany({
      where: { IS_ONLINE: true, OR: [{ IS_DELETED: false }, { IS_DELETED: null }], ...scope },
      orderBy: { USER_NAME: 'asc' },
      take: 500,
      select: { USER_ID: true, USER_NAME: true, FIRST_NAME: true, LAST_NAME: true, OA_BRAND_ID: true, CONCURRENT_LOGIN_COUNT: true },
    });
    const brands = await prisma.oa_brands.findMany({
      where: { OA_BRAND_ID: { in: [...new Set(rows.map((r) => r.OA_BRAND_ID).filter((b): b is number => b !== null))] } },
      select: { OA_BRAND_ID: true, OA_BRAND_NM: true },
    });
    const brandName = new Map(brands.map((b) => [b.OA_BRAND_ID, b.OA_BRAND_NM]));
    return rows.map((r) => ({
      id: r.USER_ID,
      username: r.USER_NAME,
      name: [r.FIRST_NAME, r.LAST_NAME].filter(Boolean).join(' '),
      brand: r.OA_BRAND_ID ? (brandName.get(r.OA_BRAND_ID) ?? null) : null,
      sessions: r.CONCURRENT_LOGIN_COUNT,
    }));
  },
};
