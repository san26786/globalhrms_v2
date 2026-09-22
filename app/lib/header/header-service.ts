import type { AccessTokenPayload } from '@/lib/auth/jwt';
import { toIntOrNull } from '@/lib/auth/getAccessPayload';
import { headerConfig } from './headerConfig';
import {
  findBrand,
  findHeaderUser,
  listRecentAnnouncements,
  listSwitchableBrands,
} from './header-repository';
import { clockFor, getPunchSnapshot } from '@/lib/attendance/punch-service';
import type { PunchState } from '@/components/layout/PunchButton';
import type { HeaderBrand, HeaderSession, UserLevel } from './headerSession';

export interface HeaderSessionOptions {
  /** Browser UTC offset in minutes east of UTC (-new Date().getTimezoneOffset()); only used to find "today" for punch status. */
  clientOffsetMinutes?: number | null;
}

async function buildPunchState(userId: number, clientOffsetMinutes?: number | null): Promise<PunchState | null> {
  if (headerConfig.punchMode === 'off') return null;
  const snapshot = await getPunchSnapshot(userId, clockFor(clientOffsetMinutes));
  if (!snapshot) return null; // no attendance-employee row: nothing to punch against
  return headerConfig.punchMode === 'interactive'
    ? { kind: 'interactive', isPunchedIn: snapshot.isPunchedIn }
    : { kind: 'readonly', record: snapshot.isPunchedIn ? 'Punch In' : 'Punch Out' };
}

/**
 * Builds everything the header renders from the database, keyed by the user id in the
 * access token. Roles, counts, last-login and punch state always come from the DB (so a role
 * change shows up without re-login); only the ACTIVE BRAND comes from the token, because
 * switching brand re-issues the token.
 *
 * autoLogoutMs / mainBackgroundColor / application / dashboardUrl / switchBrandUrl come from
 * env (headerConfig) until the login controller shows where CI reads them per brand.
 */
export async function buildHeaderSession(
  payload: AccessTokenPayload,
  options: HeaderSessionOptions = {}
): Promise<HeaderSession | null> {
  const userId = Number(payload.sub);
  if (!Number.isInteger(userId)) return null;

  const user = await findHeaderUser(userId);
  if (!user || user.IS_DELETED) return null;

  // CI is_admin: 0 employee / 1 admin / 2 super admin  ==  IS_SYSADMIN -> 2, IS_ADMIN -> 1
  const userLevel: UserLevel = user.IS_SYSADMIN ? 2 : user.IS_ADMIN ? 1 : 0;
  const activeBrandId = toIntOrNull(payload.oaBrandId) ?? user.OA_BRAND_ID ?? null;

  const [brandRow, brandRows, announcements, punch] = await Promise.all([
    activeBrandId !== null ? findBrand(activeBrandId) : Promise.resolve(null),
    userLevel !== 0
      ? listSwitchableBrands({ isSysAdmin: user.IS_SYSADMIN, oaId: user.OA_ID }, headerConfig.maxSwitchableBrands)
      : Promise.resolve([]),
    listRecentAnnouncements({ userId, oaBrandId: activeBrandId, take: headerConfig.recentAlertCount }),
    userLevel === 0 ? buildPunchState(userId, options.clientOffsetMinutes) : Promise.resolve(null),
  ]);

  const activeBrand: HeaderBrand | null = brandRow
    ? { id: brandRow.OA_BRAND_ID, name: brandRow.OA_BRAND_NM }
    : null;

  const brands: HeaderBrand[] = brandRows.map((b) => ({ id: b.OA_BRAND_ID, name: b.OA_BRAND_NM }));
  if (activeBrand && userLevel !== 0 && !brands.some((b) => b.id === activeBrand.id)) {
    brands.unshift(activeBrand); // always show where you are, even beyond the cap
  }

  const displayName = [user.FIRST_NAME, user.LAST_NAME].filter(Boolean).join(' ').trim();

  return {
    isLoggedIn: true,
    userLevel,
    username: displayName || user.USER_NAME,
    application: headerConfig.application,
    oaId: user.OA_ID,
    activeBrand,
    brands,
    lastLoginAt: user.LAST_LOGIN_AT.toISOString(),
    mainBackgroundColor: headerConfig.mainBackgroundColor,
    dashboardUrl: headerConfig.dashboardUrl,
    switchBrandUrl: headerConfig.switchBrandUrl,
    advanceSettingMenuId: headerConfig.advanceSettingMenuId,
    helpMenuId: headerConfig.helpMenuId,
    menuConfigId: headerConfig.menuConfigId,
    globalSettingsConfigId: headerConfig.globalSettingsConfigId,
    autoLogoutMs: headerConfig.autoLogoutMs,
    punch,
    alerts: {
      count: user.NOTIFY_COUNT,
      recent: announcements.map((a) => ({
        id: a.ANNOUNCEMENT_ID,
        title: a.ANNOUNCEMENT_TITLE ?? '(untitled)',
        message: a.ANNOUNCEMENT_SHORT_DESC ?? '',
        createdAt: a.CREATED_ON.toISOString(),
        read: a.STATUS_ID === 1, // CI updatestatus() sets STATUS_ID = 1
      })),
    },
  };
}
