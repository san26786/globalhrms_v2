'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { authFetch } from '@/lib/auth/authFetch';
import type { DisplayConfig, DisplayConfigRow } from './displayConfig.service';

/**
 * Client state for one object's column configuration (CI "Form Settings" modal / entity display
 * config): loads it, keeps an editable draft per column, and sends only the changed columns.
 *
 * `baseUrl` is either `/api/entity/entity_obj/{id}/display` (entity details page) or
 * `/api/entity/display-config/{objNm}` (list-view modal); both accept the same GET / PUT and
 * expose `/reset`. `null` = do not load (modal closed).
 */
export interface DisplayDraft {
  isVisible: boolean;
  label: string;
  listView: boolean;
  formView: boolean;
}

export type DisplayChange = { attributeId: number } & Partial<DisplayDraft>;

/** Starting values of the editor: the settings of the caller's own scope (system for level 2, brand for 1). */
export function draftOf(row: DisplayConfigRow, level: 1 | 2): DisplayDraft {
  const scope = level === 2 ? row.system : row.brand;
  return {
    isVisible: row.isVisible,
    label: scope?.label || (level === 2 ? row.defaultLabel : row.effective.label),
    listView: scope?.listView ?? row.effective.listView,
    formView: scope?.formView ?? row.effective.formView,
  };
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(url, init);
  const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string; data?: T } | null;
  if (!res.ok || !json?.success) throw new Error(json?.message ?? 'Request failed.');
  return json.data as T;
}

export function useDisplayConfig(baseUrl: string | null) {
  const [loaded, setLoaded] = useState<{ url: string; config: DisplayConfig } | null>(null);
  const [drafts, setDrafts] = useState<Record<number, DisplayDraft>>({});
  const [error, setError] = useState<{ url: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = useCallback((url: string, next: DisplayConfig) => {
    setLoaded({ url, config: next });
    setDrafts(Object.fromEntries(next.rows.map((r) => [r.attributeId, draftOf(r, next.adminLevel)])));
  }, []);

  useEffect(() => {
    if (!baseUrl) return;
    let cancelled = false;
    call<DisplayConfig>(baseUrl)
      .then((data) => {
        if (!cancelled) apply(baseUrl, data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError({ url: baseUrl, message: e instanceof Error ? e.message : 'Failed to load configuration.' });
      });
    return () => {
      cancelled = true;
    };
  }, [baseUrl, apply]);

  const config = baseUrl && loaded?.url === baseUrl ? loaded.config : null;
  const loadError = baseUrl && error?.url === baseUrl ? error.message : null;

  const changes = useMemo((): DisplayChange[] => {
    if (!config) return [];
    return config.rows.flatMap((row) => {
      const before = draftOf(row, config.adminLevel);
      const now = drafts[row.attributeId];
      if (!now) return [];
      const diff: Partial<DisplayDraft> = {};
      if (config.adminLevel === 2 && now.isVisible !== before.isVisible) diff.isVisible = now.isVisible;
      if (now.label.trim() !== before.label) diff.label = now.label.trim();
      if (now.listView !== before.listView) diff.listView = now.listView;
      if (now.formView !== before.formView) diff.formView = now.formView;
      return Object.keys(diff).length ? [{ attributeId: row.attributeId, ...diff }] : [];
    });
  }, [config, drafts]);

  const update = useCallback(
    (id: number, patch: Partial<DisplayDraft>) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } })),
    [],
  );

  /** Header "select all" checkboxes (CI checkAllListConfigColumns / checkAllFormConfigColumns). */
  const setAll = useCallback(
    (field: 'isVisible' | 'listView' | 'formView', value: boolean, only?: (row: DisplayConfigRow) => boolean) => {
      if (!config) return;
      setDrafts((d) => {
        const next = { ...d };
        for (const row of config.rows) {
          if (only && !only(row)) continue;
          if (next[row.attributeId]) next[row.attributeId] = { ...next[row.attributeId], [field]: value };
        }
        return next;
      });
    },
    [config],
  );

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  }, []);

  const save = useCallback(
    (options: { saveForAll?: boolean } = {}) =>
      run(async () => {
        if (!baseUrl) throw new Error('Nothing to save.');
        if (changes.some((c) => c.label === '')) throw new Error('Labels cannot be empty.');
        const next = await call<DisplayConfig>(baseUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: changes, ...(options.saveForAll ? { saveForAll: true } : {}) }),
        });
        apply(baseUrl, next);
        return next;
      }),
    [baseUrl, changes, run, apply],
  );

  const reset = useCallback(
    () =>
      run(async () => {
        if (!baseUrl) throw new Error('Nothing to reset.');
        const data = await call<{ updated: number; config: DisplayConfig }>(`${baseUrl}/reset`, { method: 'POST' });
        apply(baseUrl, data.config);
        return data;
      }),
    [baseUrl, run, apply],
  );

  /** Only for the entity details page (its own endpoint). */
  const applyAll = useCallback(
    () =>
      run(async () => {
        if (!baseUrl) throw new Error('Nothing to apply.');
        const data = await call<{ removed: number; config: DisplayConfig }>(`${baseUrl}/apply-all`, { method: 'POST' });
        apply(baseUrl, data.config);
        return data;
      }),
    [baseUrl, run, apply],
  );

  /** Throw away unsaved edits (CI modal Close → this.form.reset()). */
  const discard = useCallback(() => {
    if (config) apply(baseUrl as string, config);
  }, [config, apply, baseUrl]);

  return { config, error: loadError, drafts, changes, busy, update, setAll, save, reset, applyAll, discard };
}
