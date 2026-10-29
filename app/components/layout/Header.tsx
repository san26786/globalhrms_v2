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
import { useHeaderSession, type HeaderSessionState } from '@/lib/header/useHeaderSession';
import { useAutoLogout } from '@/lib/header/useAutoLogout';
import { useLastActiveHeartbeat } from '@/lib/header/useLastActiveHeartbeat';
import {
  DEFAULT_MAIN_BG,
  USER_LEVEL_LABEL,
  formatAlertDate,
  formatLastLogin,
  isAdminOrAbove,
  type HeaderBrand,
  type HeaderSession,
} from '@/lib/header/headerSession';
import { PROFILE_MENU, SETTINGS_MENU, visibleMenuItems } from '@/lib/header/headerMenus';
import { hrefForCi, resolveCiUrl } from '@/lib/navigation/routeRegistry';
import { PromoBanner } from './PromoBanner';
import { poppins } from '@/components/auth/AuthUi';
import { ThemeScope, ThemeSwitch } from '@/components/dashboard/DashboardUi';

/** CI header links are CI URIs; this renders them as app links, or muted text when not migrated yet. */
function CiLink({
  ci,
  className,
  onClick,
  title,
  children,
}: {
  ci: string;
  className: string;
  onClick?: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const link = resolveCiUrl(ci);
  if (link.kind === 'internal') {
    return (
      <Link href={link.href} onClick={onClick} className={className} title={title}>
        {children}
      </Link>
    );
  }
  if (link.kind === 'external') {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className} title={title}>
        {children}
      </a>
    );
  }
  return (
    <span aria-disabled="true" className={`${className} opacity-50 cursor-not-allowed`} title="This screen has not been migrated to the new application yet.">
      {children}
    </span>
  );
}

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
  /** Session state owned by the layout (shared with the sidebar). Otherwise the header loads its own. */
  sessionState?: HeaderSessionState;
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
  'flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111a2e] text-[#323338] dark:text-[#d5dae4] transition-all duration-200 hover:border-[#da5427]/40 hover:bg-[#fbe6dd] dark:hover:bg-[#da5427]/15 hover:text-[#7a2e12] dark:hover:text-[#f8d3c3] cursor-pointer';
const LINK_BTN =
  'flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111a2e] px-3 text-[13px] font-medium text-[#323338] dark:text-[#d5dae4] transition-all duration-200 hover:border-[#da5427]/40 hover:bg-[#fbe6dd] dark:hover:bg-[#da5427]/15 hover:text-[#7a2e12] dark:hover:text-[#f8d3c3]';

export default function Header({
  onLogout,
  username,
  activeBrand,
  onBrandChange,
  popup = false,
  session: sessionProp,
  sessionState,
}: HeaderProps) {
  const router = useRouter();
  const ownState = useHeaderSession(sessionProp, { enabled: !sessionState });
  const { session, unauthenticated, refresh } = sessionState ?? ownState;

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
    <ThemeScope contents>
    <header
      id="enterprise-header"
      style={{ borderTop: '3px solid var(--main-bg-color, #e15425)' }}
      className={`${poppins.className} h-20 bg-white/90 dark:bg-[#0f1729]/90 backdrop-blur border-b border-slate-200 dark:border-white/10 flex items-center justify-between px-3 sm:px-6 sticky top-0 z-40 select-none shadow-[0_8px_24px_-22px_rgba(6,27,49,0.5)]`}
    >
      {/* Left: welcome (CI marquee: "Welcome to {brandName}") */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <div className="flex flex-col text-left leading-none min-w-0">
          <span className="text-[#535768] dark:text-[#aab3c5] text-[11px] font-medium uppercase tracking-widest hidden sm:block truncate">
            {brandName ? `Welcome to ${brandName}` : 'Enterprise HR Console'}
          </span>
          <span className="text-[#1a1818] dark:text-[#f1f3f8] text-[15px] sm:text-[17px] font-medium tracking-[-0.01em] flex items-center gap-1 mt-1 sm:mt-1.5 leading-none">
            Welcome back, <span className="text-[#0b5394] dark:text-[#8cb8f0] font-semibold truncate">{displayName}</span>
          </span>
        </div>
      </div>

      {/* Right */}
      <div ref={dropdownAreaRef} className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* "Logged in at" — hidden for super admin or when there is no valid last-login time */}
        {lastLogin && (
          <div className="hidden xl:flex items-center gap-2.5 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111a2e] px-4 py-1.5">
            <span aria-hidden="true" className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" /></span>
            <div className="flex flex-col text-left leading-none">
              <span className="text-[10.5px] font-medium text-[#535768] dark:text-[#aab3c5] uppercase tracking-widest leading-none">
                Active Session
              </span>
              <span id="session-login-time" className="text-[12px] font-medium text-[#323338] dark:text-[#d5dae4] mt-1 leading-none tabular-nums">
                Logged in at <span className="text-[#0b5394] dark:text-[#8cb8f0] font-semibold">{lastLogin}</span>
              </span>
            </div>
          </div>
        )}

        {/* Punch In / Out — employees only */}
        {session.userLevel === 0 && session.punch && (
          <PunchButton punch={session.punch} onPunched={refresh} />
        )}

        {/* Dashboard shortcut (CI: only when dashboard_url is set) */}
        

        {/* Main Menu */}
        <CiLink ci="dashboard/dashboard" className={LINK_BTN} title="Main Menu">
          <Menu className="w-4 h-4 stroke-[2]" />
          <span className="hidden 2xl:inline">Main Menu</span>
        </CiLink>

        {/* Light / dark theme */}
        <ThemeSwitch className={ICON_BTN} />

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
              <span className="absolute -top-1.5 -right-1.5 bg-[#b4441f] text-white text-[10px] font-semibold min-w-[20px] h-[20px] px-1 rounded-full flex items-center justify-center border-2 border-white tabular-nums">
                {alertCount > 99 ? '99+' : alertCount}
              </span>
            )}
          </button>

          {openDropdown === 'notifications' && (
            <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-[#111a2e] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl py-3 z-50 text-left origin-top-right animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200">
              <div className="px-4 pb-2 border-b border-slate-100 dark:border-white/10">
                <span className="text-[13px] font-semibold text-[#1a1818] dark:text-[#f1f3f8]">
                  Alert Center ({alertCount} Pending)
                </span>
              </div>
              <div className="max-h-[260px] overflow-y-auto divide-y divide-slate-50">
                {session.alerts.recent.length === 0 ? (
                  <p className="px-4 py-6 text-center text-[13px] text-[#535768] dark:text-[#aab3c5]">You're all caught up.</p>
                ) : (
                  session.alerts.recent.map((noti) => (
                    <CiLink
                      key={noti.id}
                      ci="announcement/announcement"
                      onClick={closeDropdowns}
                      className="p-3.5 hover:bg-[#f6f7f9] dark:hover:bg-white/5 transition-colors flex gap-3"
                    >
                      <AlertCircle className={`w-4 h-4 mt-0.5 shrink-0 ${noti.read ? 'text-slate-400' : 'text-[#da5427]'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] truncate ${noti.read ? 'font-normal text-[#535768] dark:text-[#aab3c5]' : 'font-semibold text-[#1a1818] dark:text-[#f1f3f8]'}`}>
                          {noti.title}
                        </p>
                        {noti.message && <p className="text-[12.5px] text-[#535768] dark:text-[#aab3c5] leading-snug mt-0.5 line-clamp-2">{noti.message}</p>}
                        <span className="text-[11px] font-medium text-[#535768] dark:text-[#aab3c5] mt-1 block tabular-nums">{formatAlertDate(noti.createdAt)}</span>
                      </div>
                    </CiLink>
                  ))
                )}
              </div>
              <div className="px-2 pt-2 border-t border-slate-100 dark:border-white/10">
                <CiLink
                      ci="announcement/announcement"
                  onClick={closeDropdowns}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-[13px] font-medium text-[#0b5394] dark:text-[#8cb8f0] hover:bg-[#e3edf9] dark:hover:bg-[#16233d] transition-colors"
                >
                  View all announcements <ArrowUpRight className="w-3.5 h-3.5" />
                </CiLink>
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
              <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-[#111a2e] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-4 z-50 text-left origin-top-right animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200">
                <h4 className="text-[13px] font-semibold text-[#1a1818] dark:text-[#f1f3f8] mb-3 border-b border-slate-50 dark:border-white/5 pb-2">
                  Enterprise Settings Launcher
                </h4>
                <div className="grid grid-cols-2 gap-2 max-h-[360px] overflow-y-auto pr-0.5">
                  {settingsItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <CiLink
                        key={item.key}
                      ci={item.href(session)}
                        onClick={closeDropdowns}
                        className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-100 dark:border-white/10 hover:border-[#da5427]/30 hover:bg-[#fbe6dd] dark:hover:bg-[#da5427]/15 text-[#323338] dark:text-[#d5dae4] hover:text-[#7a2e12] dark:hover:text-[#f8d3c3] transition-all text-left text-[13px] font-medium"
                      >
                        <Icon className="w-4 h-4 text-[#535768] dark:text-[#aab3c5] stroke-[2] shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </CiLink>
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
              className="flex h-10 items-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111a2e] px-3 text-[#323338] dark:text-[#d5dae4] transition-all duration-200 hover:border-[#da5427]/40 hover:bg-[#fbe6dd] dark:hover:bg-[#da5427]/15 cursor-pointer"
              title="Switch Corporate Brand"
              aria-haspopup="true"
              aria-expanded={openDropdown === 'brand'}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-400 stroke-[2] ${openDropdown === 'brand' ? 'animate-spin' : ''}`} />
              <div className="hidden lg:flex flex-col text-left leading-none">
                <span className="text-[10px] font-medium text-[#535768] dark:text-[#aab3c5] uppercase tracking-widest">Active Brand</span>
                <span id="current-active-brand" className="text-[12.5px] font-semibold text-[#1a1818] dark:text-[#f1f3f8] truncate max-w-[120px] mt-0.5">
                  {brandName || '—'}
                </span>
              </div>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${openDropdown === 'brand' ? 'rotate-180' : ''}`} />
            </button>

            {openDropdown === 'brand' && (
              <div className="absolute right-0 mt-3 w-64 bg-white dark:bg-[#111a2e] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl py-2.5 z-50 text-left origin-top-right animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200">
                <div className="px-4 pb-2 border-b border-slate-100 dark:border-white/10">
                  <span className="text-[13px] font-semibold text-[#1a1818] dark:text-[#f1f3f8]">Select Corporate Brand</span>
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
                        className={`w-full text-left px-4 py-3 hover:bg-[#f6f7f9] dark:hover:bg-white/5 text-[13px] flex items-center justify-between transition-colors disabled:opacity-60 cursor-pointer ${
                          isSelected ? 'bg-[#e3edf9] dark:bg-[#16233d] text-[#083f72] dark:text-[#cfe1fa] font-semibold' : 'text-[#323338] dark:text-[#d5dae4]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? 'bg-[#0b5394]' : 'bg-slate-300'}`} />
                          <span className="truncate">{brand.name}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#0b5394] dark:text-[#8cb8f0] stroke-[3]" />}
                        {isSwitching && <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin" />}
                      </button>
                    );
                  })}
                </div>
                {brandError && (
                  <p role="alert" className="px-4 pt-2 text-[12px] font-medium text-rose-800">{brandError}</p>
                )}
                {session.switchBrandUrl && hrefForCi(session.switchBrandUrl) && (
                  <div className="px-2 pt-2 border-t border-slate-100 dark:border-white/10">
                    <CiLink
                      ci={session.switchBrandUrl}
                      onClick={closeDropdowns}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-[13px] font-medium text-[#0b5394] dark:text-[#8cb8f0] hover:bg-[#e3edf9] dark:hover:bg-[#16233d] transition-colors"
                    >
                      Open brand switcher <ArrowUpRight className="w-3.5 h-3.5" />
                    </CiLink>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="w-px h-8 bg-slate-200/80 dark:bg-white/10 mx-0.5 hidden sm:block" />

        {/* Profile */}
        <div className="relative">
          <button
            id="profile-dropdown-trigger"
            onClick={() => toggleDropdown('profile')}
            className="flex items-center gap-2.5 rounded-full p-1 sm:pr-2.5 hover:bg-[#f6f7f9] dark:hover:bg-white/5 transition-all text-[#1a1818] dark:text-[#f1f3f8] cursor-pointer"
            aria-haspopup="true"
            aria-expanded={openDropdown === 'profile'}
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0b5394] to-[#0a1f44] text-white shadow-[0_6px_14px_-8px_rgba(11,83,148,0.9)] flex items-center justify-center font-semibold text-[13px] shrink-0">
              {initial}
            </div>
            <div className="hidden md:flex flex-col text-left leading-none pr-1">
              <span id="user-display-name" className="text-[13.5px] font-semibold text-[#1a1818] dark:text-[#f1f3f8]">{displayName}</span>
              <span id="user-display-role" className="text-[11.5px] text-[#535768] dark:text-[#aab3c5] mt-1">
                {USER_LEVEL_LABEL[session.userLevel]}
              </span>
            </div>
            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform hidden md:inline ${openDropdown === 'profile' ? 'rotate-180' : ''}`} />
          </button>

          {openDropdown === 'profile' && (
            <div className="absolute right-0 mt-3 w-64 bg-white dark:bg-[#111a2e] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl py-2.5 z-50 text-left origin-top-right animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200">
              <div className="px-[18px] py-3 border-b border-slate-100 dark:border-white/10 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#0b5394] to-[#0a1f44] text-white shadow-[0_6px_14px_-8px_rgba(11,83,148,0.9)] flex items-center justify-center font-semibold text-[15px]">
                  {initial}
                </div>
                <div className="flex flex-col leading-none">
                  <span className="text-[14px] font-semibold text-[#1a1818] dark:text-[#f1f3f8]">{displayName}</span>
                  <span className="text-[12px] text-[#535768] dark:text-[#aab3c5] mt-1">{USER_LEVEL_LABEL[session.userLevel]}</span>
                </div>
              </div>

              <div className="max-h-[260px] overflow-y-auto py-1">
                {profileItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <CiLink
                      key={item.key}
                      ci={item.href(session)}
                      onClick={closeDropdowns}
                      className="w-full text-left px-4 py-2.5 hover:bg-[#f6f7f9] dark:hover:bg-white/5 text-[13px] text-[#323338] dark:text-[#d5dae4] flex flex-col gap-0.5 border-b border-slate-100 dark:border-white/10 last:border-0 transition-colors"
                    >
                      <div className="flex items-center gap-2 font-medium text-[#1a1818] dark:text-[#f1f3f8]">
                        <Icon className="w-3.5 h-3.5 text-[#535768] dark:text-[#aab3c5] stroke-[2.2]" />
                        <span>{item.label}</span>
                      </div>
                      {item.desc && <span className="text-[12px] text-[#535768] dark:text-[#aab3c5] pl-5 leading-snug">{item.desc}</span>}
                    </CiLink>
                  );
                })}
              </div>

              <div className="p-2 border-t border-slate-100 dark:border-white/10 bg-slate-50/50 mt-1">
                <button
                  id="profile-logout-button"
                  onClick={() => performLogout('user')}
                  disabled={loggingOut}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 rounded-full text-[13px] font-semibold text-rose-800 transition-colors border border-rose-200 dark:bg-rose-400/10 dark:hover:bg-rose-400/20 dark:text-rose-200 dark:border-rose-400/30 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
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
    {session.bannerVisible && (
      <PromoBanner logoUrl={session.brandLogoUrl ?? '/images/organisationLogo/company_logo2.jpg'} logoAlt={brandName || 'Company logo'} />
    )}
    </ThemeScope>
  );
}
