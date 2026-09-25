import { readJson, withPublicApi } from '@/lib/http/withApi';
import { assertRateLimit, clientKey } from '@/lib/http/rateLimit';
import { passwordResetService } from '@/lib/auth/passwordReset';
import { forgotUsernameSchema } from '@/validations/account.schema';

/** CI login/forgot_username — same response whether or not the details matched an account. */
export const POST = withPublicApi(async ({ req }) => {
  assertRateLimit(`forgot-username:${clientKey(req)}`, 5, 15 * 60_000);
  const { email, memorableWord } = forgotUsernameSchema.parse(await readJson(req));
  await passwordResetService.remindUsername(email, memorableWord);
  return { message: 'If the details match an account, the username has been sent to its email address.' };
});
