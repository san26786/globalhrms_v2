import { collectionRoutes } from '@/lib/resource';
import { systmSettingService } from '@/lib/systmInfoMgr/systmSetting.resource';

/** CI systmInfoMgr/systm_setting — list (server-side paging/search/sort) and create. */
export const { GET, POST } = collectionRoutes(systmSettingService);
