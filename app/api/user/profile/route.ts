import { readJson, withApi } from '@/lib/http/withApi';
import { accountService } from '@/lib/auth/accountService';
import { profileSchema } from '@/validations/account.schema';

/** CI user/profile — the logged-in user's own profile. */
export const GET = withApi(async ({ subject }) => accountService.getProfile(subject));

/** CI user/profile/editProfileDetails. */
export const PUT = withApi(async ({ req, subject }) =>
  accountService.updateProfile(subject, profileSchema.parse(await readJson(req))),
);
