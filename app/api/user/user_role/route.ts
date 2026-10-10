import { customCollectionRoutes } from '@/lib/user/userRoutes';
import { userRoleService } from '@/lib/user/userRole.service';

/** CI user/user_role — roles of a user (?userId) and add a role to that user. */
export const { GET, POST } = customCollectionRoutes(userRoleService);
