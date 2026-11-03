'use client';

import { useEffect, useRef, useState } from 'react';
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

/**
 * Several option lists at once, keyed by URL — for forms whose dependent dropdowns are described
 * by data (DynamicField.optionsUrl) rather than one hook call per field. Each URL is fetched once;
 * results are keyed by URL, so a changed parent value never shows the previous parent's options.
 */
export function useOptionsMap(urls: Array<string | null>): Record<string, SelectOption[]> {
  const key = Array.from(new Set(urls.filter((u): u is string => !!u))).sort().join('\n');
  const [loaded, setLoaded] = useState<Record<string, SelectOption[]>>({});
  const requested = useRef(new Set<string>());

  useEffect(() => {
    for (const url of key ? key.split('\n') : []) {
      if (requested.current.has(url)) continue;
      requested.current.add(url);
      authFetch(url)
        .then((res) => res.json())
        .then((json) => (json.success ? (json.data as SelectOption[]) : []))
        .catch(() => [] as SelectOption[])
        .then((options) => setLoaded((prev) => ({ ...prev, [url]: options })));
    }
  }, [key]);

  return loaded;
}
