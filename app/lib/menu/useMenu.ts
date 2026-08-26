'use client';

/**
 * Phase 15 — Dynamic Sidebar/Menu
 * This is the useSidebarMenu() hook your Sidebar.tsx already imports from
 * '@/lib/menu/useMenu'. It fetches the tree from /api/menu and hands it
 * back as-is (id/name/childMstrId/url/smallViewIcon/children per MenuNode).
 *
 * Sidebar.tsx reshapes this into its own modulesData structure and only
 * reads item.name / item.children[].name today — deeper levels and the url
 * / smallViewIcon fields are there for when routing/deep-linking gets
 * wired up.
*/

import { useCallback, useEffect, useState } from 'react';
import type { MenuNode } from '@/lib/menu/types';
import { authFetch } from '@/lib/auth/authFetch';

interface UseSidebarMenuOptions {
  parentId?: number;
  showTabs?: boolean;
}

interface UseSidebarMenuResult {
  data: MenuNode[] | undefined;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useSidebarMenu(options: UseSidebarMenuOptions = {}): UseSidebarMenuResult {
  const { parentId, showTabs } = options;

  const [data, setData] = useState<MenuNode[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (parentId != null) params.set('parentId', String(parentId));
    if (showTabs) params.set('showTabs', '1');
    const qs = params.toString();

    authFetch(`/api/menu${qs ? `?${qs}` : ''}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `Failed to load menu (${res.status})`);
        }
        const json = await res.json();
        return json.menu as MenuNode[];
      })
      .then((menu) => {
        if (!cancelled) setData(menu);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load menu');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentId, showTabs, reloadKey]);

  return { data, isLoading, error, refresh };
}