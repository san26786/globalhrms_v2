import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { terminationService } from '@/lib/employeeMngt/termination';

/** CI employeeMngt/termination/change_resignation_status/{TRMSA|TRMSR} — POST { ids, action: 'accept' | 'reject' } (admins). */
export const POST = withApi(async ({ req, subject }) => {
  const result = await terminationService.decide(subject, await readJson(req));
  return ok(result, { message: result.message });
});
