import { withApi } from '@/lib/http/withApi';
import { getMyLatestLogin } from '@/lib/systmInfoMgr/lastLogin.resource';

/** CI user_lst_login/LastLoginDetails (no id) — the caller's most recent login. */
export const GET = withApi(async ({ subject }) => getMyLatestLogin(subject));
