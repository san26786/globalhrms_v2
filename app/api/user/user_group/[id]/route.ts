import { customItemRoutes } from '@/lib/user/userRoutes';
import { userGroupService } from '@/lib/user/userGroup.service';

/** CI user/user_group — read, update (member diff), delete (soft). */
export const { GET, PUT, DELETE } = customItemRoutes(userGroupService);
