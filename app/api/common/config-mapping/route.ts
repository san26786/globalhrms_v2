import { collectionRoutes } from '@/lib/resource';
import { configMappingService } from '@/lib/common/configMapping.resource';

/**
 * CI common/config_mapping_dtl — list (CI index/{configTypeId} → `?typeId=`; server-side
 * paging/search/sort, tenant-scoped) and insert.
 */
export const { GET, POST } = collectionRoutes(configMappingService);
