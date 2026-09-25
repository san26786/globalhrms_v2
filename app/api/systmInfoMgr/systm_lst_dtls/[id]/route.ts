import { itemRoutes } from '@/lib/resource';
import { systmListDetailService } from '@/lib/systmInfoMgr/systmListDetail.resource';

/** CI systmInfoMgr/systm_lst_dtls — read, update, delete (soft). */
export const { GET, PUT, DELETE } = itemRoutes(systmListDetailService);
