/**
 * CI listview per-column search (the DataTables box under every column header: `LIKE '%term%'` on that column, applied
 * by the server across all pages). The list sends `cs_<ROW KEY>=term`; the server turns each allowed key into a
 * condition on the list's row alias. Keys outside `allowed` are ignored (they never reach the SQL text).
 */
export const COLUMN_SEARCH_PREFIX = 'cs_';

export function columnSearchConditions(rawQuery: Record<string, string>, allowed: Iterable<string>, p: (v: unknown) => string, alias = 'v'): string[] {
  const keys = new Set(allowed);
  const out: string[] = [];
  for (const [param, raw] of Object.entries(rawQuery)) {
    if (!param.startsWith(COLUMN_SEARCH_PREFIX)) continue;
    const key = param.slice(COLUMN_SEARCH_PREFIX.length);
    const term = String(raw ?? '').trim();
    if (!term || !keys.has(key) || !/^[A-Za-z0-9_]+$/.test(key)) continue;
    out.push(`${alias}."${key}"::text ILIKE ${p(`%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)}`);
  }
  return out;
}
