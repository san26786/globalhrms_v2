import type { AccessTokenPayload } from '@/lib/auth/jwt';
import { toIntOrNull } from '@/lib/auth/getAccessPayload';
import { headerConfig } from './headerConfig';
import {
  findBrand,
  findHeaderUser,
  findOrgAccountTypeCode,
  listRecentAnnouncements,
  listSwitchableBrands,
} from './header-repository';
import { clockFor, getHeaderPunchMode, getPunchSnapshot } from '@/lib/attendance/punch-service';
import { getBrandContext } from '@/lib/session/brandContext';
import type { HeaderBrand, HeaderSession, PunchState, UserLevel } from './headerSession';

export interface HeaderSessionOptions {
  /** Browser UTC offset in minutes east of UTC (-new Date().getTimezoneOffset()); only used to find "today" for punch status. */
  clientOffsetMinutes?: number | null;
}

/** CI header_v: employees see Punch In/Out (punchDisable 'no') or a read-only punch_record badge. */
async function buildPunchState(userId: number, oaBrandId: number, clientOffsetMinutes?: number | null): Promise<PunchState | null> {
  const clock = clockFor(clientOffsetMinutes);
  const snapshot = await getPunchSnapshot(userId, clock);
  if (!snapshot) return null; // no attendance-employee row: nothing to punch against
  const mode = await getHeaderPunchMode(userId, oaBrandId, clock);
  return mode === 'interactive'
    ? { kind: 'interactive', isPunchedIn: snapshot.isPunchedIn }
    : { kind: 'readonly', record: snapshot.isPunchedIn ? 'Punch In' : 'Punch Out' };
}

/**
 * CI login.php switchBrandUrl: partners and accountants get their own brand pickers; everyone
 * else the brand dashboard.
 */
function switchBrandCiUrl(orgAccountTypeCode: string | null, oaId: number | null): string {
  if (orgAccountTypeCode === 'OATP' && oaId !== null) return `systmMngt/oa_brands/switchBrandForPartners/${oaId}`;
  if (orgAccountTypeCode === 'OATACC' && oaId !== null) return `systmMngt/oa_brands/switchBrandForAccountant/${oaId}`;
  return 'systmMngt/oa_brands/MyDashboard';
}

/** CI header_v banner logo: brand logo (fallback company_logo2.jpg); super admin sees geecon.png. */
function brandLogoUrl(userLevel: UserLevel, brandId: number | null, logo: string | null | undefined): string {
  if (userLevel === 2 || brandId === null) return '/images/organisationLogo/geecon.png';
  return logo ? `/api/header/brand-logo/${brandId}` : '/images/organisationLogo/company_logo2.jpg';
}

/**
 * Builds everything the header renders, keyed by the user id in the access token. Roles, counts
 * and punch state come from the DB (a role change shows without re-login); the brand-level values
 * CI set at login come from the brand's settings (lib/session/brandContext); the ACTIVE BRAND and
 * the previous-login time come from the token (brand switch / login re-issue it).
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
  const oaId = toIntOrNull(payload.oaId) ?? user.OA_ID;

  const [brandRow, brandRows, announcements, brand, orgType] = await Promise.all([
    activeBrandId !== null ? findBrand(activeBrandId) : Promise.resolve(null),
    userLevel !== 0
      ? listSwitchableBrands({ isSysAdmin: user.IS_SYSADMIN, oaId: user.OA_ID }, headerConfig.maxSwitchableBrands)
      : Promise.resolve([]),
    listRecentAnnouncements({ userId, oaBrandId: activeBrandId, take: headerConfig.recentAlertCount }),
    activeBrandId !== null ? getBrandContext(activeBrandId) : Promise.resolve(null),
    userLevel !== 0 ? findOrgAccountTypeCode(oaId) : Promise.resolve(null),
  ]);

  const punch = userLevel === 0 && activeBrandId !== null ? await buildPunchState(userId, activeBrandId, options.clientOffsetMinutes) : null;

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
    application: brand?.application ?? null,
    oaId,
    activeBrand,
    brands,
    lastLoginAt: payload.pla ?? null,
    mainBackgroundColor: brand?.mainBackgroundColor ?? null,
    // CI set dashboard_url only for admins (login) — employees never saw the Dashboard shortcut.
    dashboardUrl: userLevel !== 0 ? brand?.dashboardUrl ?? null : null,
    switchBrandUrl: userLevel !== 0 ? switchBrandCiUrl(orgType, oaId) : null,
    advanceSettingMenuId: brand?.advanceSettingMenuId ?? null,
    helpMenuId: brand?.helpMenuId ?? null,
    menuConfigId: brand?.menuConfigTypeId ?? null,
    globalSettingsConfigId: brand?.globalSettingsConfigTypeId ?? null,
    autoLogoutMs: brand?.autoLogoutMs ?? null,
    bannerVisible: brand?.bannerVisible ?? false,
    brandLogoUrl: brandLogoUrl(userLevel, activeBrandId, brandRow?.OA_BRAND_LOGO),
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
