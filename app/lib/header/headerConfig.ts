/**
 * Values the CI app kept as PHP constants or per-login session values that are not in the
 * tables/files shared so far. Set them in .env.local (see .env.header.example).
 * They are GLOBAL stop-gaps: in CI several of these were per brand/user and set at login.
 * A missing id simply hides the menu entry that needs it.
 */
const num = (v: string | undefined): number | null => {
  if (!v || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v: string | undefined): string | null => (v && v.trim() !== '' ? v.trim() : null);

export type PunchMode = 'interactive' | 'readonly' | 'off';
const punchMode = ((): PunchMode => {
  const v = process.env.HEADER_PUNCH_MODE?.trim().toLowerCase();
  return v === 'readonly' || v === 'off' ? v : 'interactive';
})();

export const headerConfig = {
  /* ---- menu ids (PHP constants / session values) ---- */
  advanceSettingMenuId: num(process.env.HEADER_ADVANCE_SETTING_MENU_ID), // session: advance_setting_menu_id
  helpMenuId: num(process.env.HEADER_HELP_MENU_ID),                      // session: helpMenuID
  menuConfigId: num(process.env.HEADER_MENU_CONFIG_ID),                  // constant: MENUID
  globalSettingsConfigId: num(process.env.HEADER_GLOBAL_SETTINGS_CONFIG_ID), // constant: GLOBALSETTINGSID

  /* ---- session values that CI set at login ---- */
  application: str(process.env.HEADER_APPLICATION),                // session: application ('APPIMS' | 'APPBA' | ...)
  autoLogoutMs: num(process.env.HEADER_AUTO_LOGOUT_MS),            // session: auto_logout_time_milliseconds
  mainBackgroundColor: str(process.env.HEADER_MAIN_BG_COLOR),      // session: mainBackgroundColor
  dashboardUrl: str(process.env.HEADER_DASHBOARD_URL),             // session: dashboard_url
  switchBrandUrl: str(process.env.HEADER_SWITCH_BRAND_URL),        // session: switchBrandUrl

  /* ---- punch ---- */
  /** 'interactive' = CI punchDisable == 'no'; 'readonly' = status badge only; 'off' = hide. */
  punchMode,
  /** IANA zone (e.g. Asia/Kolkata) used for "user time". Unset = use the browser's UTC offset. */
  punchTimeZone: str(process.env.HEADER_PUNCH_TIMEZONE),
  /** CI: brand setting SSAMDB (minimum minutes between 2 punches). Not readable yet — see README. */
  punchMinGapMinutes: num(process.env.HEADER_PUNCH_MIN_GAP_MINUTES) ?? 0,

  /* ---- limits ---- */
  maxSwitchableBrands: 50,
  recentAlertCount: 5,
} as const;
