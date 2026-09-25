import { collectionRoutes } from '@/lib/resource';
import { authorityLevelService } from '@/lib/user/authorityLevel.resource';

/** CI authoritylevel/authoritylevel — list and create. */
export const { GET, POST } = collectionRoutes(authorityLevelService);
