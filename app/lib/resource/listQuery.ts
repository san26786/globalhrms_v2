import { z } from 'zod';
import type { ListQuery } from './types';

/** Query-string contract shared by every list endpoint: ?page&limit&search&sort&dir&<filters>. */
const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(100).optional(),
  sort: z.string().trim().max(60).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
});

const RESERVED = new Set(['page', 'limit', 'search', 'sort', 'dir']);

export function parseListQuery(raw: Record<string, string>): ListQuery {
  const base = listQuerySchema.parse(raw);
  const filters: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!RESERVED.has(key) && value !== '') filters[key] = value;
  }
  return { ...base, search: base.search || undefined, filters };
}
