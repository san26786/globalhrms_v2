import { itemRoutes } from '@/lib/resource';
import { roleMasterService } from '@/lib/user/roleMaster.resource';

/** CI user/role_master — read, update, delete (soft). */
export const { GET, PUT, DELETE } = itemRoutes(roleMasterService);
