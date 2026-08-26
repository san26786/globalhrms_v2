'use client';

/**
 * Wraps fetch so that any request hitting a 401 (expired access token)
 * automatically tries /api/auth/refresh once, then retries the original
 * request. If refresh also fails (refresh token expired/invalid too),
 * the original 401 response is returned as-is so callers can redirect
 * to /login.
 *
 * Multiple simultaneous 401s (e.g. several widgets fetching at once)
 * share a single in-flight refresh call instead of each firing their own.
 */

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const res = await fetch(input, { ...init, credentials: 'include' });

  if (res.status !== 401) {
    return res;
  }

  const refreshed = await tryRefresh();
  if (!refreshed) {
    return res; // still 401 — caller should treat as logged out
  }

  return fetch(input, { ...init, credentials: 'include' });
}