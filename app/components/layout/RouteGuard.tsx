'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { authFetch } from '@/lib/auth/authFetch';
import { useNavigation } from '@/lib/navigation/NavigationContext';

/**
 * Page-level permission check for menu screens (GET /api/navigation/access): the same
 * permission_dtl FUNCTION grant that decides whether the menu item is shown. It makes direct URLs,
 * bookmarks and refreshes behave like the menu; APIs still enforce every action themselves.
 * Decisions are cached for the page load (a brand switch reloads the page).
 */

type Decision = { allowed: true } | { allowed: false; message: string };

const decisions = new Map<string, Promise<Decision>>();

function loadDecision(path: string, search: string): Promise<Decision> {
  const key = `${path}?${search}`;
  let pending = decisions.get(key);
  if (!pending) {
    const qs = new URLSearchParams({ path, search });
    pending = authFetch(`/api/navigation/access?${qs}`, { cache: 'no-store' })
      .then(async (res): Promise<Decision> => {
        const json = (await res.json().catch(() => null)) as { success?: boolean; data?: { allowed: boolean } } | null;
        if (res.ok && json?.success && json.data) {
          return json.data.allowed ? { allowed: true } : { allowed: false, message: 'You do not have permission to access this page.' };
        }
        // Could not decide (network / server error): let the page load — its APIs enforce access.
        decisions.delete(key);
        return { allowed: true };
      })
      .catch((): Decision => {
        decisions.delete(key);
        return { allowed: true };
      });
    decisions.set(key, pending);
  }
  return pending;
}

export default function RouteGuard({ children }: { children: ReactNode }) {
  const { pathname, search } = useNavigation();
  const searchString = search.toString();
  const key = `${pathname}?${searchString}`;
  const [result, setResult] = useState<{ key: string; decision: Decision } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadDecision(pathname, searchString).then((decision) => {
      if (!cancelled) setResult({ key, decision });
    });
    return () => {
      cancelled = true;
    };
  }, [pathname, searchString, key]);

  const decision = result?.key === key ? result.decision : null;

  if (decision === null) {
    return (
      <div className="flex items-center justify-center py-24" aria-busy="true">
        <div className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" />
      </div>
    );
  }

  if (!decision.allowed) {
    return (
      <div className="mx-auto max-w-lg mt-16 rounded-3xl border bg-white p-8 text-center shadow-sm">
        <ShieldAlert className="mx-auto h-10 w-10 text-red-500" />
        <h1 className="mt-4 text-lg font-black text-slate-800">Access denied</h1>
        <p className="mt-2 text-sm text-slate-500">{decision.message}</p>
        <Link href="/dashboard" className="mt-6 inline-block rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
