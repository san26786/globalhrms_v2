'use client';

import { useEffect } from 'react';
import { authFetch } from '@/lib/auth/authFetch';

interface Options {
  enabled: boolean;
  /** CI: 480000 (8 minutes). */
  intervalMs?: number;
  endpoint?: string;
}

/**
 * Port of `updateLastActive()` in header_v.php: ping once on load, then again
 * `intervalMs` after each SUCCESSFUL ping.
 *
 * Preserved from the source: the chain only continues on success (jQuery `.done`),
 * so one failed request (e.g. an expired session) stops the heartbeat.
 * To keep pinging through failures, move the reschedule into a `finally`.
 */
export function useLastActiveHeartbeat({
  enabled,
  intervalMs = 480_000,
  endpoint = '/api/session/update-last-active',
}: Options) {
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const ping = async () => {
      try {
        const res = await authFetch(endpoint, { method: 'POST' });
        if (!res.ok) throw new Error(`Heartbeat failed (${res.status})`);
        if (!cancelled) timer = setTimeout(ping, intervalMs);
      } catch (err) {
        console.error('Last-active heartbeat stopped:', err);
      }
    };

    void ping();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, intervalMs, endpoint]);
}
