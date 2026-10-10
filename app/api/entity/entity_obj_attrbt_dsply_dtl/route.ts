import { collectionRoutes } from '@/lib/resource';
import { entityObjAttrbtDsplyDtlService } from '@/lib/entity/display/entityObjAttrbtDsplyDtl.resource';

/** CI entity/entity_obj_attrbt_dsply_dtl — list (scoped) and create. */
export const { GET, POST } = collectionRoutes(entityObjAttrbtDsplyDtlService);
