import { readJson, withApi } from '@/lib/http/withApi';
import { accountService } from '@/lib/auth/accountService';
import { changePasswordSchema } from '@/validations/account.schema';

/** CI user/changepassword/editChangepassword — the logged-in user changes their own password. */
export const POST = withApi(async ({ req, subject }) =>
  accountService.changePassword(subject, changePasswordSchema.parse(await readJson(req))),
);
