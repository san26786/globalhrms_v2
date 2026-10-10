import { z } from 'zod';
import { readJson, readQuery, withPublicApi } from '@/lib/http/withApi';
import { assertRateLimit, clientKey } from '@/lib/http/rateLimit';
import { passwordResetService } from '@/lib/auth/passwordReset';
import { resetPasswordSchema } from '@/validations/account.schema';

/** GET ?token= — is the reset link still valid (CI forgot_pass/reset_pass)? */
export const GET = withPublicApi(async ({ req }) => {
  assertRateLimit(`reset-check:${clientKey(req)}`, 30, 15 * 60_000);
  const token = z.string().min(20).max(200).safeParse(readQuery(req).token);
  return { valid: token.success ? await passwordResetService.isTokenValid(token.data) : false };
});

/** POST { token, password, confirmPassword } — CI forgot_pass/changepass. */
export const POST = withPublicApi(async ({ req }) => {
  assertRateLimit(`reset-password:${clientKey(req)}`, 10, 15 * 60_000);
  const { token, password } = resetPasswordSchema.parse(await readJson(req));
  await passwordResetService.resetPassword(token, password);
  return { message: 'Password Reset Successfully Done' };
});
