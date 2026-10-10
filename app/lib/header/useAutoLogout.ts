'use client';

import { useEffect, useRef } from 'react';

interface Options {
  enabled: boolean;
  timeoutMs: number;
  onTimeout: () => void;
}

/**
 * Idle timer. Port of the inline script in header_v.php:
 * start on load, restart on mousemove / mousedown / keydown / touchstart.
 */
export function useAutoLogout({ enabled, timeoutMs, onTimeout }: Options) {
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    if (!enabled || !timeoutMs || timeoutMs <= 0) return;

    let timer: ReturnType<typeof setTimeout>;
    const start = () => {
      clearTimeout(timer);
      timer = setTimeout(() => onTimeoutRef.current(), timeoutMs);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart'] as const;
    events.forEach((e) => document.body.addEventListener(e, start, { passive: true }));
    start();

    return () => {
      clearTimeout(timer);
      events.forEach((e) => document.body.removeEventListener(e, start));
    };
  }, [enabled, timeoutMs]);
}
