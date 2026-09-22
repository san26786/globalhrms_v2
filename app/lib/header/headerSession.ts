/**
 * Everything the header needs to know about the logged-in user, as ONE typed object built
 * server-side by lib/header/header-service.ts and served by GET /api/header/session.
 * Replaces the ~20 `$this->session->userdata(...)` reads in CodeIgniter's header_v.php.
 */

/** CI `is_admin`: 0 = employee, 1 = admin (IS_ADMIN), 2 = super admin (IS_SYSADMIN). */
export type UserLevel = 0 | 1 | 2;

export const USER_LEVEL_LABEL: Record<UserLevel, string> = {
  0: 'Employee',
  1: 'Admin',
  2: 'Super Admin',
};

/** CI: punchDisable == 'no' -> interactive; otherwise a read-only status badge. */
export type PunchState =
  | { kind: 'interactive'; isPunchedIn: boolean }
  | { kind: 'readonly'; record: string };

export interface HeaderBrand {
  id: number;
  name: string;
}

export interface HeaderAlert {
  id: number;
  title: string;
  message: string;
  /** ISO timestamp. */
  createdAt: string;
  read: boolean;
}

export interface HeaderSession {
  isLoggedIn: boolean;
  userLevel: UserLevel;
  username?: string | null;
  application?: string | null;          // 'APPIMS' | 'APPBA' | ...
  oaId?: number | null;
  activeBrand?: HeaderBrand | null;
  brands?: HeaderBrand[];               // brands this user may switch to (admins only)
  /** ISO timestamp of the login (user_mst.LAST_LOGIN_AT). */
  lastLoginAt?: string | null;
  mainBackgroundColor?: string | null;
  dashboardUrl?: string | null;
  switchBrandUrl?: string | null;
  advanceSettingMenuId?: number | null;
  helpMenuId?: number | null;
  menuConfigId?: number | null;
  globalSettingsConfigId?: number | null;
  autoLogoutMs?: number | null;
  punch?: PunchState | null;
  alerts: { count: number; recent: HeaderAlert[] };
}

/** Least-privileged fallback: used until the real session arrives, or if it fails to load. */
export const DEFAULT_HEADER_SESSION: HeaderSession = {
  isLoggedIn: false,
  userLevel: 0,
  alerts: { count: 0, recent: [] },
};

/** CI: `#e15425` was the fallback for `--main-bg-color`. */
export const DEFAULT_MAIN_BG = '#e15425';

export const isSuperAdmin = (s: HeaderSession) => s.userLevel === 2;
export const isAdminOrAbove = (s: HeaderSession) => s.userLevel !== 0;

/** CI href fragments are relative ('user/profile'); Next paths need a leading slash. */
export const toAppPath = (p: string) => (p.startsWith('/') ? p : `/${p}`);

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * PHP: date('d/m/Y | h:i:sa', strtotime($lastLoginAt)); hidden when empty or '0000-00-00 00:00:00'.
 * ISO strings (with Z / offset) are shown in the browser's local time. A bare 'YYYY-MM-DD HH:mm:ss'
 * is shown as written, with no timezone shift.
 */
export function formatLastLogin(raw?: string | null): string | null {
  if (!raw || raw.startsWith('0000-00-00')) return null;

  let y: number, mo: number, d: number, h24: number, mi: number, s: number;
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(raw)) {
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) return null;
    [y, mo, d, h24, mi, s] = [dt.getFullYear(), dt.getMonth() + 1, dt.getDate(), dt.getHours(), dt.getMinutes(), dt.getSeconds()];
  } else {
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (!m) return null;
    [y, mo, d, h24, mi, s] = m.slice(1).map(Number) as [number, number, number, number, number, number];
  }

  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${pad(d)}/${pad(mo)}/${y} | ${pad(h12)}:${pad(mi)}:${pad(s)}${h24 >= 12 ? 'pm' : 'am'}`;
}

/** Short date for alert rows (legacy rows were written in the PHP server's timezone, so time-of-day is omitted). */
export function formatAlertDate(iso: string): string {
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime())
    ? ''
    : dt.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}
