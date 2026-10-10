'use client';

import { useEffect, useState } from 'react';
import { authFetch } from '@/lib/auth/authFetch';
import type { SelectOption } from '@/lib/form-builder/formTypes';

/**
 * Loads dropdown options from a lookup endpoint (e.g. '/api/lookups/masters?typeId=3').
 * Pass `null` to skip — that is how dependent dropdowns wait for their parent value
 * (CI changeDropdown()). Stale responses from a previous parent value are ignored.
 */
export function useOptions(url: string | null): { options: SelectOption[]; loading: boolean } {
  // The result is keyed by the URL it was loaded for, so a changed/cleared URL never shows stale options.
  const [result, setResult] = useState<{ url: string; options: SelectOption[] } | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    authFetch(url)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setResult({ url, options: json.success ? (json.data as SelectOption[]) : [] });
      })
      .catch(() => {
        if (!cancelled) setResult({ url, options: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!url) return { options: [], loading: false };
  const current = result?.url === url ? result : null;
  return { options: current?.options ?? [], loading: current === null };
}
