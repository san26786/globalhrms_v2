import { itemRoutes } from '@/lib/resource';
import { userTypeRoleMappingService } from '@/lib/user/userTypeRoleMapping.resource';

/** CI user/user_type_role_mapping (sysadmin only) — read, update, delete (soft). */
export const { GET, PUT, DELETE } = itemRoutes(userTypeRoleMappingService);
