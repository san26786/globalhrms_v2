import { cookies } from 'next/headers';
import type { AppSession, SessionReader } from '../domain/session/AppSession';

/**
 * STUB — mirrors the stub nature of lib/auth/tenantContext.ts from the
 * entity module. This reads nothing real yet; it exists so Header/*
 * components have a concrete dependency to call instead of touching
 * cookies/DB directly, and so it's a single seam to rewire once real
 * auth/session storage lands.
 *
 * Flagged open item: consolidate this with getTenantContext() so there
 * is one source of truth for "who is the current user / brand" rather
 * than two parallel session readers.
 */
export class CookieSessionReader implements SessionReader {
  async getSession(): Promise<AppSession> {
    const store = cookies();

    return {
      isLoggedIn: store.has('session_id'),
      isAdmin: 0,
      username: null,
      brandName: '',
      lastLoginAt: null,
      dashboardUrl: null,
      switchBrandUrl: null,
      helpMenuId: null,
      advanceSettingMenuId: null,
      oaBrandId: null,
      oaId: null,
      application: 'APPIMS',
      bannerVisible: false,
      mainBackgroundColor: '#e15425',
      autoLogoutTimeMs: null,
      punchDisable: 'no',
      punchRecord: null,
    };
  }
}
