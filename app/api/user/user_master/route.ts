import { customCollectionRoutes } from '@/lib/user/userRoutes';
import { userMasterService } from '@/lib/user/userMaster.service';

/** CI user/user_master — list (user_mst_vw) and create (user + history + employee + roles + access). */
export const { GET, POST } = customCollectionRoutes(userMasterService);
