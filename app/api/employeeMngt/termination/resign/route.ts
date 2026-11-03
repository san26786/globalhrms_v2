import { created } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { terminationService } from '@/lib/employeeMngt/termination';

/** CI employeeMngt/termination/sendResignation — POST { reason }: a normal user's resignation (one pending record). */
export const POST = withApi(async ({ req, subject }) => {
  const result = await terminationService.resign(subject, await readJson(req));
  return created(result, { message: result.message });
});
