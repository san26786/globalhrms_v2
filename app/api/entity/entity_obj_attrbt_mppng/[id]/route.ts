import { itemRoutes } from '@/lib/resource';
import { entityObjAttrbtMppngService } from '@/lib/entity/mapping/entityObjAttrbtMppng.resource';

/** CI entity/entity_obj_attrbt_mppng — read, update, delete (soft). */
export const { GET, PUT, DELETE } = itemRoutes(entityObjAttrbtMppngService);
