/**
 * lib/dashboard/db.ts
 *
 * Thin convenience wrapper around the existing `query()` function in `lib/db.ts`.
 * We don't touch lib/db.ts itself — it already handles the real Postgres pool vs.
 * the local JSON-emulation fallback. This file just adds two small helpers that
 * the dashboard queries use repeatedly.
 *
 * NOTE: adjust the import path below if your `lib/db.ts` lives somewhere other
 * than the project root `lib/db.ts` (it was shared to me as a standalone file,
 * so I'm assuming the conventional `@/lib/db` alias).
 */
import { query } from '../../../db';

/** Run a query and return the first row, or null if there were no rows. */
export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows.length > 0 ? rows[0] : null;
}

/** Run a query and return all rows (alias kept for readability in dashboard queries). */
export async function queryMany<T = any>(text: string, params?: any[]): Promise<T[]> {
  return query<T>(text, params);
}

export { query };
