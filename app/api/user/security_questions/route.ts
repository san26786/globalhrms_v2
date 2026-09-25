import { readJson, withApi } from '@/lib/http/withApi';
import { accountService } from '@/lib/auth/accountService';
import { securityQuestionsSchema } from '@/validations/account.schema';

/** CI user/security_questions — question options + current choices (answers are never returned). */
export const GET = withApi(async ({ subject }) => accountService.getSecurityQuestions(subject));

/** CI user/security_questions/editSecurityQuestions. */
export const PUT = withApi(async ({ req, subject }) =>
  accountService.saveSecurityQuestions(subject, securityQuestionsSchema.parse(await readJson(req))),
);
