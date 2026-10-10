'use client';

import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { authFetch } from '@/lib/auth/authFetch';
import type { MenuNode } from '@/lib/menu/types';
import { matchScore } from './routeRegistry';

/**
 * One source of navigation state for the dashboard shell: the permission-filtered menu tree
 * (GET /api/menu, loaded once per page load — a brand switch reloads the page) and the menu
 * trail of the current location. Sidebar, dashboard tabs and page headers read it from here,
 * so they can never disagree about where the user is.
 */

export interface NavigationState {
  menu: MenuNode[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  pathname: string;
  search: URLSearchParams;
  /** Root → leaf menu nodes of the current location ([] when the page is not in the menu). */
  activeTrail: MenuNode[];
  isActive: (node: MenuNode) => boolean;
}

const NavigationContext = createContext<NavigationState | null>(null);

interface MenuResponse {
  success: boolean;
  message?: string;
  data?: { menu: MenuNode[] };
}

function findTrail(nodes: MenuNode[], pathname: string, search: URLSearchParams): MenuNode[] {
  let best: { score: number; trail: MenuNode[] } | null = null;
  const walk = (list: MenuNode[], parents: MenuNode[]) => {
    for (const node of list) {
      const trail = [...parents, node];
      if (node.link.kind === 'internal') {
        const score = matchScore(node.link.href, pathname, search);
        // Deeper nodes win ties so a child is preferred over a parent pointing at the same page.
        if (score > 0 && (!best || score > best.score || (score === best.score && trail.length > best.trail.length))) {
          best = { score, trail };
        }
      }
      walk(node.children, trail);
    }
  };
  walk(nodes, []);
  return (best as { score: number; trail: MenuNode[] } | null)?.trail ?? [];
}

/** Keeps the search params in state; isolated so only it bails out of prerendering (Suspense). */
function SearchParamsSync({ onChange }: { onChange: (search: string) => void }) {
  const params = useSearchParams();
  const value = params.toString();
  useEffect(() => onChange(value), [value, onChange]);
  return null;
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';
  const [searchString, setSearchString] = useState('');
  const [menu, setMenu] = useState<MenuNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    authFetch('/api/menu', { cache: 'no-store' })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as MenuResponse | null;
        if (!res.ok || !json?.success || !json.data) throw new Error(json?.message ?? `Failed to load menu (${res.status}).`);
        return json.data.menu;
      })
      .then((tree) => {
        if (!cancelled) setMenu(tree);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load menu.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const search = useMemo(() => new URLSearchParams(searchString), [searchString]);
  const activeTrail = useMemo(() => findTrail(menu, pathname, search), [menu, pathname, search]);
  const activeIds = useMemo(() => new Set(activeTrail.map((n) => n.id)), [activeTrail]);
  const isActive = useCallback((node: MenuNode) => activeIds.has(node.id), [activeIds]);

  const value = useMemo<NavigationState>(
    () => ({ menu, loading, error, reload, pathname, search, activeTrail, isActive }),
    [menu, loading, error, reload, pathname, search, activeTrail, isActive],
  );

  return (
    <NavigationContext.Provider value={value}>
      <Suspense fallback={null}>
        <SearchParamsSync onChange={setSearchString} />
      </Suspense>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation(): NavigationState {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used inside <NavigationProvider>.');
  return ctx;
}
