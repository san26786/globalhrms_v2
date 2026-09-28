'use client';

import { useCallback, useEffect, useState } from 'react';
import { authFetch } from '@/lib/auth/authFetch';
import type { ListColumn } from './displayConfig.service';

/**
 * Effective list columns of an entity object for the caller (GET /api/entity/display-config/
 * {objNm}/columns), keyed by upper-cased column name. `reload()` after the Form Settings modal saves.
 * An empty map means "no configuration": the list keeps its declared columns.
 */
export function useListColumns(objectName: string | undefined) {
  const [state, setState] = useState<{ key: string; columns: Map<string, ListColumn> } | null>(null);
  const [version, setVersion] = useState(0);
  const key = objectName ? `${objectName}#${version}` : '';

  useEffect(() => {
    if (!objectName) return;
    let cancelled = false;
    authFetch(`/api/entity/display-config/${encodeURIComponent(objectName)}/columns`, { cache: 'no-store' })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as { success?: boolean; data?: ListColumn[] } | null;
        return res.ok && json?.success && json.data ? json.data : [];
      })
      .catch((): ListColumn[] => [])
      .then((list) => {
        if (!cancelled) setState({ key, columns: new Map(list.map((c) => [c.name.trim().toUpperCase(), c])) });
      });
    return () => {
      cancelled = true;
    };
  }, [objectName, key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const columns = state?.key === key ? state.columns : null;

  return { columns, loading: !!objectName && columns === null, reload };
}
