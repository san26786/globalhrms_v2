import { created } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { terminationService } from '@/lib/employeeMngt/termination';

/**
 * CI employeeMngt/termination/sendResignation — POST { reason }: a normal user's resignation (one pending
 * record) and its e-mails to HR and the employee (a mail failure is named in the message; the record stays).
 */
export const POST = withApi(async ({ req, subject }) => {
  const result = await terminationService.resign(subject, await readJson(req), req.nextUrl.origin);
  return created(result, { message: result.message });
});
