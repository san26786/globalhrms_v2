import { itemRoutes } from '@/lib/resource';
import { configMappingService } from '@/lib/common/configMapping.resource';

/** CI common/config_mapping_dtl — editConfigMappingDetails / update / delete (soft). */
export const { GET, PUT, DELETE } = itemRoutes(configMappingService);
