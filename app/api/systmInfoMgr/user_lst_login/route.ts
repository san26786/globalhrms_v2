import { collectionRoutes } from '@/lib/resource';
import { lastLoginService } from '@/lib/systmInfoMgr/lastLogin.resource';

/** CI systmInfoMgr/user_lst_login — scoped, read-only list of login history. */
export const { GET } = collectionRoutes(lastLoginService);
