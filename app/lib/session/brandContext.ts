import { prisma } from '@/lib/prisma';
import { getMasterId } from '@/lib/masters/masterService';
import { isYes, periodToMinutes, settingService, toNumber } from '@/lib/settings/settingService';

/**
 * The brand-level values CI's login::validate_credentials() computed once and stored in the
 * PHP session (header_v / left_menu_v then read them from $this->session). Here they are
 * derived from the same settings on demand and cached briefly per brand, so a brand switch or
 * a settings change is picked up without re-login.
 *
 *  CI session key                 source (CI login.php)
 *  ---------------------------    --------------------------------------------------------------
 *  brandApplicationID             setting SSABAN (brand), default 370
 *  application                    master code of brandApplicationID ('IMSA', 'APPIMS', 'APPBA', …)
 *  auto_logout_time_milliseconds  setting group SEAL: SSALP × minutes(SSALF) × 60000
 *  banner_visible                 setting SSAABV (brand) == 'yes'
 *  mainBackgroundColor            setting SSAAPCOL (system, brand 0) == master CRBE ? #0f70b7 : #e15425
 *  punchDisable                   setting SSADPBTM (brand), default 'no'   (+ SSAAWPFAO, per user)
 *  (punch gap)                    setting SSAMDB (brand): minimum minutes between punch-in and punch-out
 *  dashboard_url                  dashboard_mapping.URL where APPLICATION_CODE = application
 *  advance_setting_menu_id        master id of MMADVSET
 *  helpMenuID                     master id of PNSP
 *  MENUID / GLOBALSETTINGSID      PHP constants (helpers/const_helper.php): 84 / 36
 */

export const DEFAULT_BRAND_APPLICATION_ID = 370;
export const MENU_CONFIG_TYPE_ID = 84; // const_helper.php MENUID
export const GLOBAL_SETTINGS_CONFIG_TYPE_ID = 36; // const_helper.php GLOBALSETTINGSID

const COLOR_BLUE = '#0f70b7';
const COLOR_ORANGE = '#e15425';

export interface BrandContext {
  oaBrandId: number;
  brandApplicationId: number;
  application: string | null;
  autoLogoutMs: number | null;
  bannerVisible: boolean;
  mainBackgroundColor: string;
  /** CI punchDisable: brand setting says the header punch button is disabled. */
  punchButtonDisabled: boolean;
  /** CI SSAAWPFAO: an approved outdoor entry for today re-enables the punch button. */
  webPunchForApprovedOutdoor: boolean;
  /** CI checkForPunchDiff(): minimum minutes between two punches (SSAMDB); 0 = no rule. */
  punchMinGapMinutes: number;
  dashboardUrl: string | null;
  advanceSettingMenuId: number | null;
  helpMenuId: number | null;
  menuConfigTypeId: number;
  globalSettingsConfigTypeId: number;
}

const TTL_MS = 60_000;
const cache = new Map<number, { at: number; value: Promise<BrandContext> }>();

async function load(oaBrandId: number): Promise<BrandContext> {
  const [appSetting, seal, banner, color, punchDisable, odPunch, punchGap, blueId, advanceId, helpId] = await Promise.all([
    settingService.getValue('SSABAN', oaBrandId),
    settingService.getGroupValues(oaBrandId, ['SEAL']),
    settingService.getValue('SSAABV', oaBrandId),
    settingService.getValue('SSAAPCOL', 0),
    settingService.getValue('SSADPBTM', oaBrandId),
    settingService.getValue('SSAAWPFAO', oaBrandId),
    settingService.getValue('SSAMDB', oaBrandId),
    getMasterId('CRBE'),
    getMasterId('MMADVSET'),
    getMasterId('PNSP'),
  ]);

  const appId = Number(appSetting);
  const brandApplicationId = Number.isInteger(appId) && appId > 0 ? appId : DEFAULT_BRAND_APPLICATION_ID;

  const [appRow, blueRow] = await Promise.all([
    prisma.independent_mst.findFirst({ where: { MSTR_ID: brandApplicationId }, select: { MSTR_CD: true } }),
    blueId !== null ? prisma.independent_mst.findFirst({ where: { MSTR_ID: blueId }, select: { MSTR_NM: true } }) : null,
  ]);
  const application = appRow?.MSTR_CD ?? null;

  const dashboard = application
    ? await prisma.dashboard_mapping.findFirst({ where: { APPLICATION_CODE: application }, select: { URL: true } })
    : null;

  const logoutMinutes = periodToMinutes(seal.SSALP, seal.SSALF);
  // The option answer resolves to the option's master name; CI compared the option's master id with CRBE.
  const isBlue = !!color && !!blueRow?.MSTR_NM && color.trim().toLowerCase() === blueRow.MSTR_NM.trim().toLowerCase();

  return {
    oaBrandId,
    brandApplicationId,
    application,
    autoLogoutMs: logoutMinutes > 0 ? logoutMinutes * 60_000 : null,
    bannerVisible: isYes(banner),
    mainBackgroundColor: isBlue ? COLOR_BLUE : COLOR_ORANGE,
    punchButtonDisabled: (punchDisable ?? 'no').trim().toLowerCase() !== 'no' && (punchDisable ?? '').trim() !== '',
    webPunchForApprovedOutdoor: isYes(odPunch),
    punchMinGapMinutes: Math.max(0, toNumber(punchGap)),
    dashboardUrl: dashboard?.URL ?? null,
    advanceSettingMenuId: advanceId,
    helpMenuId: helpId,
    menuConfigTypeId: MENU_CONFIG_TYPE_ID,
    globalSettingsConfigTypeId: GLOBAL_SETTINGS_CONFIG_TYPE_ID,
  };
}

/** Brand context for the active brand; cached for a minute per brand (failed loads are not cached). */
export function getBrandContext(oaBrandId: number): Promise<BrandContext> {
  const hit = cache.get(oaBrandId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = load(oaBrandId);
  cache.set(oaBrandId, { at: Date.now(), value });
  value.catch(() => cache.delete(oaBrandId));
  return value;
}

/**
 * Drop the cached context after the brand's settings changed (CI cache_delete_all() in
 * change_module_settings). Brand 0 holds the system defaults every brand falls back to, so
 * clearing it clears all brands.
 */
export function invalidateBrandContext(oaBrandId: number): void {
  if (oaBrandId === 0) cache.clear();
  else cache.delete(oaBrandId);
}

/** CI monthly_register_m::checkODExists(today, user, ODSA): an approved outdoor entry covers `day`. */
export async function hasApprovedOutdoorOn(userId: number, day: Date): Promise<boolean> {
  const approvedId = await getMasterId('ODSA');
  if (approvedId === null) return false;
  const row = await prisma.outdrentr.findFirst({
    where: {
      USER_ID: userId,
      OD_STATUS: approvedId,
      IS_DELETED: 0,
      START_DATE: { lte: day },
      END_DATE: { gte: day },
    },
    select: { OD_TYPE_ID: true },
  });
  return row !== null;
}
