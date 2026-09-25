import { customItemRoutes } from '@/lib/user/userRoutes';
import { userRoleService } from '@/lib/user/userRole.service';

/** CI user/user_role — read, update, delete (soft). */
export const { GET, PUT, DELETE } = customItemRoutes(userRoleService);
