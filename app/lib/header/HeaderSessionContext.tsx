'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { HeaderSessionState } from './useHeaderSession';
import type { HeaderSession } from './headerSession';

/**
 * The session the dashboard layout loaded once (GET /api/header/session), shared with pages —
 * CI views read $this->session->userdata(...) directly; here pages read this context.
 */
const HeaderSessionContext = createContext<HeaderSessionState | null>(null);

export function HeaderSessionProvider({ value, children }: { value: HeaderSessionState; children: ReactNode }) {
  return <HeaderSessionContext.Provider value={value}>{children}</HeaderSessionContext.Provider>;
}

/** The current session, or null outside the dashboard layout. */
export function useCurrentSession(): HeaderSession | null {
  return useContext(HeaderSessionContext)?.session ?? null;
}
