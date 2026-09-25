import { collectionRoutes } from '@/lib/resource';
import { entityObjService } from '@/lib/entity/entityObj/entityObj.resource';

/** CI entity/entity_obj — list (?search, ?objTyp, server paging) and create. */
export const { GET, POST } = collectionRoutes(entityObjService);
