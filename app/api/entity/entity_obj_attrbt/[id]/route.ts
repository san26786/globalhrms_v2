import { itemRoutes } from '@/lib/resource';
import { entityObjAttrbtService } from '@/lib/entity/entityObjAttrbt/entityObjAttrbt.resource';

/** CI entity/entity_obj_attrbt — read, update, delete (soft). */
export const { GET, PUT, DELETE } = itemRoutes(entityObjAttrbtService);
