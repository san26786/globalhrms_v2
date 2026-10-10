import { itemRoutes } from '@/lib/resource';
import { lastLoginService } from '@/lib/systmInfoMgr/lastLogin.resource';

/** CI user_lst_login/LastLoginDetails/{id} — one entry, within the caller's scope. */
export const { GET } = itemRoutes(lastLoginService);
