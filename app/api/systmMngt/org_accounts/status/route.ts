import { z } from 'zod';
import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { orgAccountsService as svc } from '@/lib/systmMngt/orgAccounts';

/**
 * GET → what the list toolbar offers · POST { status: 'OASA' | 'OASI', ids: number[] } → CI
 * org_change_status/{OASA|OASI} (Activate / Deactivate Account, superadmin).
 */
const bodySchema = z.object({
  status: z.enum(['OASA', 'OASI']),
  ids: z.array(z.coerce.number().int().positive()).max(1000).default([]),
});

export const GET = withApi(async ({ subject }) => svc.capabilities(subject));

export const POST = withApi(async ({ req, subject }) => {
  const body = bodySchema.parse(await readJson(req));
  const result = await svc.changeStatus(subject, body.status, [...new Set(body.ids)]);
  return ok(result, { message: result.message });
});
