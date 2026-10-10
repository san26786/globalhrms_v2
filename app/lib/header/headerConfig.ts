/**
 * Deployment-level header settings. Everything CI derived per brand/user at login (application,
 * auto-logout, colours, dashboard URL, punch rules, menu ids) now comes from the database via
 * lib/session/brandContext.ts — only values that are not brand data remain here.
 */
const str = (v: string | undefined): string | null => (v && v.trim() !== '' ? v.trim() : null);

export const headerConfig = {
  /** IANA zone (e.g. Asia/Kolkata) used for punch "user time". Unset = use the browser's UTC offset. */
  punchTimeZone: str(process.env.HEADER_PUNCH_TIMEZONE),

  /* ---- limits ---- */
  maxSwitchableBrands: 50,
  recentAlertCount: 5,
} as const;
