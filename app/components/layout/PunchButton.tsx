'use client';

import React, { useState } from 'react';
import { Fingerprint, Loader2 } from 'lucide-react';
import { authFetch } from '@/lib/auth/authFetch';
import type { PunchState } from '@/lib/header/headerSession';

export type { PunchState };

interface PunchButtonProps {
  punch: PunchState;
  /** Called after a successful punch (refresh session + server components). */
  onPunched?: () => void | Promise<void>;
}

const IN_STYLE = 'text-emerald-700 bg-emerald-50 border-emerald-200';
const OUT_STYLE = 'text-rose-700 bg-rose-50 border-rose-200';
const IN_HOVER = 'hover:bg-emerald-100';
const OUT_HOVER = 'hover:bg-rose-100';
const BASE = 'flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-bold transition-colors';

export default function PunchButton({ punch, onPunched }: PunchButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (punch.kind === 'readonly') {
    const isIn = punch.record === 'Punch In';
    return (
      <span
        title={`You are currently ${punch.record}`}
        className={`${BASE} cursor-default ${isIn ? IN_STYLE : OUT_STYLE}`}
      >
        <Fingerprint className="w-4 h-4 stroke-[2]" />
        <span className="hidden md:inline">{punch.record}</span>
      </span>
    );
  }

  const nextAction = punch.isPunchedIn ? 'out' : 'in';
  const label = punch.isPunchedIn ? 'Punch Out' : 'Punch In';

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // CI used a state-changing GET (…/employee_records_insert_quick_punchin/0). POST is the safe verb.
      const res = await authFetch('/api/attendance/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: nextAction, utcOffsetMinutes: -new Date().getTimezoneOffset() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        // 409 = the button was stale (already in / not in): re-sync so the label flips, and say why.
        if (res.status === 409) await onPunched?.();
        throw new Error(body?.message ?? `${label} failed (${res.status}). Try again.`);
      }
      await onPunched?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${label} failed. Try again.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      id="punch-button"
      onClick={handleClick}
      disabled={busy}
      title={error ?? label}
      aria-live="polite"
      className={`${BASE} ${punch.isPunchedIn ? `${OUT_STYLE} ${OUT_HOVER}` : `${IN_STYLE} ${IN_HOVER}`} ${
        error ? 'ring-2 ring-red-400' : ''
      } disabled:opacity-60 disabled:cursor-wait`}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4 stroke-[2]" />}
      <span className="hidden md:inline">{busy ? 'Saving…' : label}</span>
    </button>
  );
}
