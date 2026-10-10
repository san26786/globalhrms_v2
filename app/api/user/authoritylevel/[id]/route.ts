import { itemRoutes } from '@/lib/resource';
import { authorityLevelService } from '@/lib/user/authorityLevel.resource';

/** CI authoritylevel/authoritylevel — read, update, delete (soft). */
export const { GET, PUT, DELETE } = itemRoutes(authorityLevelService);
