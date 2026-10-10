import { collectionRoutes } from '@/lib/resource';
import { userTypeRoleMappingService } from '@/lib/user/userTypeRoleMapping.resource';

/** CI user/user_type_role_mapping (sysadmin only) — list and create. */
export const { GET, POST } = collectionRoutes(userTypeRoleMappingService);
