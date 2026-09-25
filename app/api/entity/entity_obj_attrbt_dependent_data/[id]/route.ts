import { itemRoutes } from '@/lib/resource';
import { entityObjAttrbtDependentDataService } from '@/lib/entity/dependent/entityObjAttrbtDependentData.resource';

/** CI entity/entity_obj_attrbt_dependent_data — read and update only (CI had no delete). */
export const { GET, PUT } = itemRoutes(entityObjAttrbtDependentDataService);
