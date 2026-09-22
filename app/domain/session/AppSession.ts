/**
 * Ported from the CodeIgniter session fields read throughout header.php:
 * is_logged_in, is_admin, username, brandName, lastLoginAt, dashboard_url,
 * switchBrandUrl, helpMenuID, advance_setting_menu_id, oaBrandID, oaID,
 * application, banner_visible, mainBackgroundColor, auto_logout_time_milliseconds,
 * punchDisable, punch_record.
 *
 * is_admin values preserved from source: 0 = employee, 1 = brand/org admin,
 * 2 = super admin (platform-level). Do not rename these to something more
 * readable without confirming every call site — the source overloads this
 * field heavily for permission checks.
 */
export interface AppSession {
  isLoggedIn: boolean;
  isAdmin: 0 | 1 | 2;
  username: string | null;
  brandName: string;
  lastLoginAt: string | null; // ISO string; PHP compared against '0000-00-00 00:00:00'
  dashboardUrl: string | null;
  switchBrandUrl: string | null;
  helpMenuId: number | null;
  advanceSettingMenuId: number | null;
  oaBrandId: number | null;
  oaId: number | null;
  application: 'APPIMS' | 'APPBA' | string;
  bannerVisible: boolean;
  mainBackgroundColor: string; // defaults to '#e15425' in source
  autoLogoutTimeMs: number | null;
  punchDisable: 'yes' | 'no';
  punchRecord: string | null; // used only when punchDisable === 'yes'
}

export interface SessionReader {
  getSession(): Promise<AppSession>;
}
