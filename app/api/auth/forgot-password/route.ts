import { readJson, withPublicApi } from '@/lib/http/withApi';
import { assertRateLimit, clientKey } from '@/lib/http/rateLimit';
import { appBaseUrl, passwordResetService } from '@/lib/auth/passwordReset';
import { forgotPasswordSchema } from '@/validations/account.schema';

/**
 * CI login/forgot_pass/forgotpass. The response is identical whether or not the email belongs to
 * an account (no account enumeration).
 */
export const POST = withPublicApi(async ({ req }) => {
  assertRateLimit(`forgot-password:${clientKey(req)}`, 5, 15 * 60_000);
  const { email } = forgotPasswordSchema.parse(await readJson(req));
  await passwordResetService.requestReset(email, appBaseUrl(req.nextUrl.origin));
  return { message: 'If an account exists for that email address, a password reset link has been sent.' };
});
