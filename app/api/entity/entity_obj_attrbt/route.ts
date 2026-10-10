import { collectionRoutes } from '@/lib/resource';
import { entityObjAttrbtService } from '@/lib/entity/entityObjAttrbt/entityObjAttrbt.resource';

/** CI entity/entity_obj_attrbt/index/{OBJ_NM} — list (?objNm=) and create. */
export const { GET, POST } = collectionRoutes(entityObjAttrbtService);
