import { itemRoutes } from '@/lib/resource';
import { entityObjAttrbtDsplyDtlService } from '@/lib/entity/display/entityObjAttrbtDsplyDtl.resource';

/** CI entity/entity_obj_attrbt_dsply_dtl — read, update, delete (soft). */
export const { GET, PUT, DELETE } = itemRoutes(entityObjAttrbtDsplyDtlService);
