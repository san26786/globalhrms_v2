import { collectionRoutes } from '@/lib/resource';
import { systmListDetailService } from '@/lib/systmInfoMgr/systmListDetail.resource';

/** CI systmInfoMgr/systm_lst_dtls — list (server-side paging/search/sort) and create. */
export const { GET, POST } = collectionRoutes(systmListDetailService);
