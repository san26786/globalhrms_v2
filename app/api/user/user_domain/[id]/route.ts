import { itemRoutes } from '@/lib/resource';
import { userDomainService } from '@/lib/user/userDomain.resource';

/** CI user/user_domain — read, update, delete (soft). */
export const { GET, PUT, DELETE } = itemRoutes(userDomainService);
