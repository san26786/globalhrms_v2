'use client';

import { useEffect } from 'react';

const HEARTBEAT_MS = 480_000; // 8 minutes, matches source's setTimeout chain

/**
 * Ported from updateLastActive(), which re-scheduled itself via
 * setTimeout(..., 480000) inside its own AJAX .done() callback.
 * Reimplemented as setInterval, which is behaviorally equivalent here
 * since the source didn't depend on drift-correction or backoff.
 */
export function useLastActiveHeartbeat(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const ping = () => {
      fetch('/api/session/update-last-active', { method: 'POST' }).catch(() => {
        // Source ignored failures (no .fail() handler); preserved.
      });
    };

    ping();
    const id = setInterval(ping, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [enabled]);
}
