/** Reads a positive integer query parameter from Next's page `searchParams` (e.g. `?typeId=230`). */
export function positiveIntParam(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;
