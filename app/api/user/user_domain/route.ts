import { collectionRoutes } from '@/lib/resource';
import { userDomainService } from '@/lib/user/userDomain.resource';

/** CI user/user_domain — list and create. */
export const { GET, POST } = collectionRoutes(userDomainService);
