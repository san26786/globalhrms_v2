import { itemRoutes } from '@/lib/resource';
import { systmSettingService } from '@/lib/systmInfoMgr/systmSetting.resource';

/** CI systmInfoMgr/systm_setting — read, update, delete (soft). */
export const { GET, PUT, DELETE } = itemRoutes(systmSettingService);
