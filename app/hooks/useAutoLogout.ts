'use client';

import { useEffect, useRef } from 'react';

/**
 * Ported from the inline <script> in header.php:
 *   - only armed when is_logged_in, is_admin != 2, and a timeout is configured
 *   - resets on mousemove/mousedown/keydown/touchstart
 *
 * Behavior note (preserved from source, not fixed): the PHP auto_logout()
 * function only console.log'd the timer id and never actually redirected
 * to the logout URL — the redirect line was commented out. Reproduced
 * as-is below (onIdle is a no-op by default) so this doesn't silently
 * start logging users out where the legacy app never did. Pass a real
 * onIdle to opt into fixing that.
 */
export function useAutoLogout(options: {
  enabled: boolean;
  timeoutMs: number | null;
  onIdle?: () => void;
}) {
  const { enabled, timeoutMs, onIdle } = options;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !timeoutMs) return;

    const fire = () => {
      // Source behavior: logged the timer id and did nothing else.
      // eslint-disable-next-line no-console
      console.log(timerRef.current);
      onIdle?.();
    };

    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(fire, timeoutMs);
    };

    reset();
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart'] as const;
    events.forEach((evt) => document.body.addEventListener(evt, reset));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((evt) => document.body.removeEventListener(evt, reset));
    };
  }, [enabled, timeoutMs, onIdle]);
}
