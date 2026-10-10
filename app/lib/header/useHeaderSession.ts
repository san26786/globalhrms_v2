'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/auth/authFetch';
import { DEFAULT_HEADER_SESSION, type HeaderSession } from './headerSession';

/**
 * Two ways to feed the header:
 *  - Preferred: read the session in a Server Component layout and pass it as `initial`.
 *  - Otherwise: the hook fetches GET /api/header/session on mount.
 * (A server-fed session can't know the browser's UTC offset, which only affects today's punch status.)
 *
 * If loading fails, the header falls back to the least-privileged (employee) view.
 */
export interface HeaderSessionState {
  session: HeaderSession;
  loading: boolean;
  unauthenticated: boolean;
  refresh: () => Promise<void>;
}

export function useHeaderSession(initial?: HeaderSession, options: { enabled?: boolean } = {}): HeaderSessionState {
  const router = useRouter();
  const enabled = options.enabled ?? true;
  const serverFed = initial !== undefined || !enabled;
  const [fetched, setFetched] = useState<HeaderSession | null>(null);
  const [loading, setLoading] = useState(!serverFed);
  const [unauthenticated, setUnauthenticated] = useState(false);

  const load = useCallback(async () => {
    try {
      // authFetch retries once via /api/auth/refresh when the 15-minute access token has expired.
      const offset = -new Date().getTimezoneOffset();
      const res = await authFetch(`/api/header/session?utcOffsetMinutes=${offset}`, { cache: 'no-store' });
      if (res.status === 401) {
        setUnauthenticated(true); // refresh failed too: the login has expired
        return;
      }
      if (!res.ok) throw new Error(`Session request failed (${res.status})`);
      setUnauthenticated(false);
      setFetched((await res.json()) as HeaderSession);
    } catch (err) {
      console.error('Header session load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!serverFed) void load();
  }, [serverFed, load]);

  /** Re-read the session and re-render server components (replaces PHP's `location.href = ""`). */
  const refresh = useCallback(async () => {
    if (!serverFed) await load();
    router.refresh();
  }, [serverFed, load, router]);

  return { session: initial ?? fetched ?? DEFAULT_HEADER_SESSION, loading, unauthenticated, refresh };
}
