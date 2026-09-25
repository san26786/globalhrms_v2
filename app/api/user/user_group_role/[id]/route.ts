import { itemRoutes } from '@/lib/resource';
import { userGroupRoleService } from '@/lib/user/userGroupRole.resource';

/** CI user/user_group_role — read, update, delete (soft). */
export const { GET, PUT, DELETE } = itemRoutes(userGroupRoleService);
