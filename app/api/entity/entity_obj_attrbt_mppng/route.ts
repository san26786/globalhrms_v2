import { collectionRoutes } from '@/lib/resource';
import { entityObjAttrbtMppngService } from '@/lib/entity/mapping/entityObjAttrbtMppng.resource';

/** CI entity/entity_obj_attrbt_mppng — list (?objMppngId) and create. */
export const { GET, POST } = collectionRoutes(entityObjAttrbtMppngService);
