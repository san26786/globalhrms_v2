import { customCollectionRoutes } from '@/lib/user/userRoutes';
import { userGroupService } from '@/lib/user/userGroup.service';

/** CI user/user_group (+ members, user_group_dtl) — list and create. */
export const { GET, POST } = customCollectionRoutes(userGroupService);
