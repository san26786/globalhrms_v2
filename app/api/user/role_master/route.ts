import { collectionRoutes } from '@/lib/resource';
import { roleMasterService } from '@/lib/user/roleMaster.resource';

/** CI user/role_master — list (?domainId) and create. */
export const { GET, POST } = collectionRoutes(roleMasterService);
