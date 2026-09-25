import { collectionRoutes } from '@/lib/resource';
import { userGroupRoleService } from '@/lib/user/userGroupRole.resource';

/** CI user/user_group_role — list (?groupId) and create. */
export const { GET, POST } = collectionRoutes(userGroupRoleService);
