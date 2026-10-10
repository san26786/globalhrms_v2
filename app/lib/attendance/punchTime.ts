/**
 * emp_attendance_record stores three things per punch:
 *   PUNCH_x_UTC_TIME     the real instant (UTC)
 *   PUNCH_x_USER_TIME    the wall-clock time where the employee is  (what CI reports read)
 *   PUNCH_x_TIME_OFFSET  user time minus UTC, in seconds, as a string
 * The columns are `timestamp without time zone`, and Prisma writes a Date's UTC fields, so
 * "user time" is stored as a Date whose UTC fields equal the local wall clock.
 *
 * CI used the web server's clock for user time. Here the zone comes from HEADER_PUNCH_TIMEZONE
 * when set (tamper-proof, same as CI), otherwise from the browser's offset.
 */
export interface PunchClock {
  utc: Date;
  userTime: Date;
  offsetSeconds: number;
  /** [dayStart, dayEnd) of the user's current day, in the same "wall clock as UTC" encoding. */
  dayStart: Date;
  dayEnd: Date;
}

const MAX_OFFSET_MINUTES = 14 * 60;

function offsetMsForZone(instantMs: number, timeZone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(new Date(instantMs));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    return Number.isFinite(asUtc) ? asUtc - instantMs : null;
  } catch {
    return null; // unknown zone name
  }
}

export function resolvePunchClock(
  now: Date,
  opts: { timeZone?: string | null; clientOffsetMinutes?: number | null }
): PunchClock {
  const instantMs = Math.floor(now.getTime() / 1000) * 1000;

  let offsetMs: number | null = opts.timeZone ? offsetMsForZone(instantMs, opts.timeZone) : null;
  if (offsetMs === null && typeof opts.clientOffsetMinutes === 'number' && Number.isFinite(opts.clientOffsetMinutes)) {
    const clamped = Math.max(-MAX_OFFSET_MINUTES, Math.min(MAX_OFFSET_MINUTES, Math.round(opts.clientOffsetMinutes)));
    offsetMs = clamped * 60_000;
  }
  offsetMs ??= 0;

  const utc = new Date(instantMs);
  const userTime = new Date(instantMs + offsetMs);
  const dayStart = new Date(Date.UTC(userTime.getUTCFullYear(), userTime.getUTCMonth(), userTime.getUTCDate()));
  return { utc, userTime, offsetSeconds: Math.round(offsetMs / 1000), dayStart, dayEnd: new Date(dayStart.getTime() + 86_400_000) };
}
