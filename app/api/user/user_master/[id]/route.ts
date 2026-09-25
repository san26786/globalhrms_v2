import { customItemRoutes } from '@/lib/user/userRoutes';
import { userMasterService } from '@/lib/user/userMaster.service';

/** CI user/user_master — read, update, delete (soft; not predefined users, not self). */
export const { GET, PUT, DELETE } = customItemRoutes(userMasterService);
