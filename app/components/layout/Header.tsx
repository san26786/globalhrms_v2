'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowUpRight,
  Bell,
  Check,
  ChevronDown,
  LayoutDashboard,
  LayoutGrid,
  Menu,
  Power,
  RefreshCw,
} from 'lucide-react';
import PunchButton from './PunchButton';
import { authFetch } from '@/lib/auth/authFetch';
import { useHeaderSession } from '@/lib/header/useHeaderSession';
import { useAutoLogout } from '@/lib/header/useAutoLogout';
import { useLastActiveHeartbeat } from '@/lib/header/useLastActiveHeartbeat';
import {
  DEFAULT_MAIN_BG,
  USER_LEVEL_LABEL,
  formatAlertDate,
  formatLastLogin,
  isAdminOrAbove,
  toAppPath,
  type HeaderBrand,
  type HeaderSession,
} from '@/lib/header/headerSession';
import { PROFILE_MENU, SETTINGS_MENU, visibleMenuItems } from '@/lib/header/headerMenus';

interface HeaderProps {
  onLogout: () => void;
  /** Optional: the session supplies the user's name; pass this only to override it. */
  username?: string;
  /** Optional fallback label; the session's active brand takes precedence. */
  activeBrand?: string;
  /** Called after the server has switched brand (the page then reloads). */
  onBrandChange?: (brand: string) => void;
  /** CI `$popup`: render no header at all (timers below still run, as in the CI page). */
  popup?: boolean;
  /** Preferred: pass the session from a Server Component layout. Otherwise it is fetched from /api/header/session. */
  session?: HeaderSession;
  // Legacy props from the previous header — accepted so existing callers keep compiling, no longer used.
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  activeMenu?: string;
  onSelectMenu?: (menu: string) => void;
}

type OpenDropdown = 'profile' | 'launcher' | 'notifications' | 'brand' | null;

/**
 * CI's auto_logout() has its redirect commented out, so the idle timer only
 * console.logs today. Preserved on purpose; set to true to really log users out when idle.
 */
const AUTO_LOGOUT_REDIRECTS: boolean = false;

const ICON_BTN =
  'p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl border border-slate-200/50 transition-all';
const LINK_BTN =
  'flex items-center gap-1.5 px-2.5 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl border border-slate-200/50 transition-all';

export default function Header({
  onLogout,
  username,
  activeBrand,
  onBrandChange,
  popup = false,
  session: sessionProp,
}: HeaderProps) {
  const router = useRouter();
  const { session, unauthenticated, refresh } = useHeaderSession(sessionProp);

  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const dropdownAreaRef = useRef<HTMLDivElement>(null);

  const [switchingBrandId, setSwitchingBrandId] = useState<number | null>(null);
  const [brandError, setBrandError] = useState<string | null>(null);

  const adminUp = isAdminOrAbove(session);
  const displayName = session.username || username || '';

  const brandName = session.activeBrand?.name ?? activeBrand ?? '';
  const brands = session.brands ?? [];
  const lastLogin = session.userLevel !== 2 ? formatLastLogin(session.lastLoginAt) : null;
  const alertCount = session.alerts.count;

  const toggleDropdown = (name: Exclude<OpenDropdown, null>) =>
    setOpenDropdown((prev) => (prev === name ? null : name));
  const closeDropdowns = () => setOpenDropdown(null);

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!openDropdown) return;
    const onMouseDown = (e: MouseEvent) => {
      if (dropdownAreaRef.current && !dropdownAreaRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && setOpenDropdown(null);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openDropdown]);

  // The access token and its refresh both failed: the login has expired, so leave like a normal logout.
  useEffect(() => {
    if (unauthenticated) {
      onLogout();
      router.replace('/login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unauthenticated]);

  // CI: `:root { --main-bg-color: <session mainBackgroundColor or #e15425> }`
  useEffect(() => {
    document.documentElement.style.setProperty('--main-bg-color', session.mainBackgroundColor || DEFAULT_MAIN_BG);
  }, [session.mainBackgroundColor]);

  const performLogout = async (reason: 'user' | 'idle' = 'user') => {
    setOpenDropdown(null);
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
    } catch (err) {
      // Even if the network call fails, still clear local state and
      // send the user to login rather than leaving them stuck.
      console.error('Logout request failed:', err);
    } finally {
      onLogout();
      router.push('/login');
    }
  };

  /**
   * Real brand switch: the server re-checks permission and re-issues the access token.
   * A full reload follows because the sidebar menu and page data are brand-scoped.
   */
  const switchBrand = async (brand: HeaderBrand) => {
    if (brand.id === session.activeBrand?.id) return closeDropdowns();
    setSwitchingBrandId(brand.id);
    setBrandError(null);
    try {
      const res = await authFetch('/api/header/switch-brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oaBrandId: brand.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `Could not switch brand (${res.status}).`);
      }
      onBrandChange?.(brand.name);
      window.location.reload();
    } catch (err) {
      setBrandError(err instanceof Error ? err.message : 'Could not switch brand.');
      setSwitchingBrandId(null);
    }
  };

  // CI: only for logged-in, non-super-admin users with a configured timeout.
  useAutoLogout({
    enabled: session.isLoggedIn && session.userLevel !== 2 && (session.autoLogoutMs ?? 0) > 0,
    timeoutMs: session.autoLogoutMs ?? 0,
    onTimeout: () => {
      if (AUTO_LOGOUT_REDIRECTS) void performLogout('idle');
      else console.log('[auto-logout] idle timeout reached (redirect disabled, as in the CI source)');
    },
  });

  // CI: updateLastActive() every 8 minutes.
  useLastActiveHeartbeat({ enabled: session.isLoggedIn });

  if (popup) return null;

  const profileItems = visibleMenuItems(PROFILE_MENU, session);
  const settingsItems = visibleMenuItems(SETTINGS_MENU, session);
  const initial = displayName ? displayName.charAt(0).toUpperCase() : 'D';

  return (
    <header
      id="enterprise-header"
      style={{ borderTop: '3px solid var(--main-bg-color, #e15425)' }}
      className="h-20 bg-white border-b border-slate-150 flex items-center justify-between px-3 sm:px-6 sticky top-0 z-40 select-none shadow-sm shadow-slate-100/40"
    >
      {/* Left: welcome (CI marquee: "Welcome to {brandName}") */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <div className="flex flex-col text-left leading-none font-sans min-w-0">
          <span className="text-slate-400 text-[9px] font-black uppercase tracking-widest hidden sm:block truncate">
            {brandName ? `Welcome to ${brandName}` : 'Enterprise HR Console'}
          </span>
          <span className="text-slate-800 text-xs sm:text-sm font-black flex items-center gap-1 mt-0.5 sm:mt-1 leading-none">
            Welcome back, <span className="text-blue-600 font-extrabold truncate">{displayName}</span>
          </span>
        </div>
      </div>

      {/* Right */}
      <div ref={dropdownAreaRef} className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* "Logged in at" — hidden for super admin or when there is no valid last-login time */}
        {lastLogin && (
          <div className="hidden xl:flex items-center gap-2 border border-slate-200/80 rounded-xl px-3 py-1.5 bg-slate-50/50">
            <div className="flex flex-col text-left leading-none font-sans">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
                Active Session
              </span>
              <span id="session-login-time" className="text-[10px] font-bold text-slate-700 mt-0.5 leading-none font-mono">
                Logged in at <span className="text-blue-600 font-black">{lastLogin}</span>
              </span>
            </div>
          </div>
        )}

        {/* Punch In / Out — employees only */}
        {session.userLevel === 0 && session.punch && (
          <PunchButton punch={session.punch} onPunched={refresh} />
        )}

        {/* Dashboard shortcut (CI: only when dashboard_url is set) */}
        {session.dashboardUrl && (
          <Link href={toAppPath(session.dashboardUrl)} className={LINK_BTN} title="Dashboard">
            <LayoutDashboard className="w-4 h-4 stroke-[2]" />
            <span className="hidden 2xl:inline">Dashboard</span>
          </Link>
        )}

        {/* Main Menu */}
        <Link href="/dashboard/dashboard" className={LINK_BTN} title="Main Menu">
          <Menu className="w-4 h-4 stroke-[2]" />
          <span className="hidden 2xl:inline">Main Menu</span>
        </Link>

        {/* Notifications */}
        <div className="relative">
          <button
            id="notifications-dropdown-trigger"
            onClick={() => toggleDropdown('notifications')}
            className={`${ICON_BTN} relative`}
            title="System Notifications"
            aria-haspopup="true"
            aria-expanded={openDropdown === 'notifications'}
          >
            <Bell className="w-4 h-4 stroke-[2]" />
            {alertCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-[#ff5252] text-white text-[9px] font-black min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center border-2 border-white">
                {alertCount > 99 ? '99+' : alertCount}
              </span>
            )}
          </button>

          {openDropdown === 'notifications' && (
            <div className="absolute right-0 mt-3 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl py-3 z-50 text-left animate-fade-in font-sans">
              <div className="px-4 pb-2 border-b border-slate-100">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Alert Center ({alertCount} Pending)
                </span>
              </div>
              <div className="max-h-[260px] overflow-y-auto divide-y divide-slate-50">
                {session.alerts.recent.length === 0 ? (
                  <p className="px-4 py-6 text-center text-[11px] text-slate-400">You're all caught up.</p>
                ) : (
                  session.alerts.recent.map((noti) => (
                    <Link
                      key={noti.id}
                      href="/announcement/announcement"
                      onClick={closeDropdowns}
                      className="p-3.5 hover:bg-slate-50 transition-colors flex gap-3"
                    >
                      <AlertCircle className={`w-4 h-4 mt-0.5 shrink-0 ${noti.read ? 'text-slate-300' : 'text-blue-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs truncate ${noti.read ? 'font-medium text-slate-500' : 'font-bold text-slate-700'}`}>
                          {noti.title}
                        </p>
                        {noti.message && <p className="text-[11px] text-slate-500 leading-tight mt-0.5 line-clamp-2">{noti.message}</p>}
                        <span className="text-[9px] font-bold text-slate-400 mt-1 block font-mono">{formatAlertDate(noti.createdAt)}</span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
              <div className="px-2 pt-2 border-t border-slate-100">
                <Link
                  href="/announcement/announcement"
                  onClick={closeDropdowns}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  View all announcements <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Settings launcher — admins only (CI: is_admin != 0) */}
        {adminUp && (
          <div className="relative">
            <button
              id="launcher-dropdown-trigger"
              onClick={() => toggleDropdown('launcher')}
              className={ICON_BTN}
              title="Settings"
              aria-haspopup="true"
              aria-expanded={openDropdown === 'launcher'}
            >
              <LayoutGrid className="w-4 h-4 stroke-[2]" />
            </button>

            {openDropdown === 'launcher' && (
              <div className="absolute right-0 mt-3 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 z-50 text-left animate-fade-in font-sans">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3 border-b border-slate-50 pb-2">
                  Enterprise Settings Launcher
                </h4>
                <div className="grid grid-cols-2 gap-2 max-h-[360px] overflow-y-auto pr-0.5">
                  {settingsItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.key}
                        href={toAppPath(item.href(session))}
                        onClick={closeDropdowns}
                        className="flex items-center gap-2.5 p-2 rounded-xl border border-slate-50 hover:border-blue-100 hover:bg-blue-50/20 text-slate-600 hover:text-blue-600 transition-all text-left text-xs font-bold"
                      >
                        <Icon className="w-4 h-4 text-slate-400 stroke-[2] shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Switch brand — admins only (CI: is_admin != 0) */}
        {adminUp && (
          <div className="relative">
            <button
              id="brand-dropdown-trigger"
              onClick={() => toggleDropdown('brand')}
              className="flex items-center gap-1.5 px-2 py-1.5 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 text-slate-700 hover:text-blue-600 transition-all hover:border-slate-300 font-sans"
              title="Switch Corporate Brand"
              aria-haspopup="true"
              aria-expanded={openDropdown === 'brand'}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-400 stroke-[2] ${openDropdown === 'brand' ? 'animate-spin' : ''}`} />
              <div className="hidden lg:flex flex-col text-left leading-none">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Brand</span>
                <span id="current-active-brand" className="text-[11px] font-bold text-slate-700 truncate max-w-[120px] mt-0.5">
                  {brandName || '—'}
                </span>
              </div>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${openDropdown === 'brand' ? 'rotate-180' : ''}`} />
            </button>

            {openDropdown === 'brand' && (
              <div className="absolute right-0 mt-3 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl py-2.5 z-50 text-left animate-fade-in font-sans">
                <div className="px-4 pb-2 border-b border-slate-100">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Select Corporate Brand</span>
                </div>
                <div className="max-h-[220px] overflow-y-auto py-1">
                  {brands.map((brand) => {
                    const isSelected = session.activeBrand?.id === brand.id;
                    const isSwitching = switchingBrandId === brand.id;
                    return (
                      <button
                        key={brand.id}
                        onClick={() => switchBrand(brand)}
                        disabled={switchingBrandId !== null}
                        className={`w-full text-left px-4 py-3 hover:bg-slate-50 text-xs flex items-center justify-between transition-colors disabled:opacity-60 ${
                          isSelected ? 'bg-blue-50/30 text-blue-600 font-bold' : 'text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? 'bg-blue-600' : 'bg-slate-300'}`} />
                          <span className="truncate">{brand.name}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 stroke-[3]" />}
                        {isSwitching && <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin" />}
                      </button>
                    );
                  })}
                </div>
                {brandError && (
                  <p role="alert" className="px-4 pt-2 text-[11px] font-bold text-red-600">{brandError}</p>
                )}
                {session.switchBrandUrl && (
                  <div className="px-2 pt-2 border-t border-slate-100">
                    <Link
                      href={toAppPath(session.switchBrandUrl)}
                      onClick={closeDropdowns}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      Open brand switcher <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="w-px h-8 bg-slate-200/80 mx-0.5 hidden sm:block" />

        {/* Profile */}
        <div className="relative">
          <button
            id="profile-dropdown-trigger"
            onClick={() => toggleDropdown('profile')}
            className="flex items-center gap-2 p-1 rounded-full sm:rounded-xl hover:bg-slate-50 transition-all text-slate-700"
            aria-haspopup="true"
            aria-expanded={openDropdown === 'profile'}
          >
            <div className="w-8 h-8 rounded-full bg-[#dcfce7] border border-[#bbf7d0] flex items-center justify-center font-black text-xs text-[#15803d] shrink-0">
              {initial}
            </div>
            <div className="hidden md:flex flex-col text-left leading-none pr-1">
              <span id="user-display-name" className="text-xs font-bold text-slate-800">{displayName}</span>
              <span id="user-display-role" className="text-[9px] font-medium text-slate-400 mt-0.5">
                {USER_LEVEL_LABEL[session.userLevel]}
              </span>
            </div>
            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform hidden md:inline ${openDropdown === 'profile' ? 'rotate-180' : ''}`} />
          </button>

          {openDropdown === 'profile' && (
            <div className="absolute right-0 mt-3 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl py-2.5 z-50 text-left animate-fade-in font-sans">
              <div className="px-[18px] py-3 border-b border-slate-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#dcfce7] flex items-center justify-center font-black text-sm text-[#15803d]">
                  {initial}
                </div>
                <div className="flex flex-col leading-none">
                  <span className="text-xs font-black text-slate-800">{displayName}</span>
                  <span className="text-[10px] font-bold text-slate-400 mt-1">{USER_LEVEL_LABEL[session.userLevel]}</span>
                </div>
              </div>

              <div className="max-h-[260px] overflow-y-auto py-1">
                {profileItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.key}
                      href={toAppPath(item.href(session))}
                      onClick={closeDropdowns}
                      className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs text-slate-700 flex flex-col gap-0.5 border-b border-slate-50 last:border-0 transition-colors"
                    >
                      <div className="flex items-center gap-2 font-bold text-slate-700">
                        <Icon className="w-3.5 h-3.5 text-slate-400 stroke-[2.2]" />
                        <span>{item.label}</span>
                      </div>
                      {item.desc && <span className="text-[10px] text-slate-400 pl-5 leading-tight">{item.desc}</span>}
                    </Link>
                  );
                })}
              </div>

              <div className="p-2 border-t border-slate-100 bg-slate-50/50 mt-1">
                <button
                  id="profile-logout-button"
                  onClick={() => performLogout('user')}
                  disabled={loggingOut}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 rounded-xl text-xs font-bold text-red-600 hover:text-red-700 transition-colors border border-red-200/30 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Power className="w-3.5 h-3.5 stroke-[2]" />
                  {loggingOut ? 'Logging out...' : 'Logout Session'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
