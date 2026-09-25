import { collectionRoutes } from '@/lib/resource';
import { entityObjAttrbtDependentDataService } from '@/lib/entity/dependent/entityObjAttrbtDependentData.resource';

/** CI entity/entity_obj_attrbt_dependent_data — list only (CI had no insert). */
export const { GET } = collectionRoutes(entityObjAttrbtDependentDataService);
