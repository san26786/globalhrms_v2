import { collectionRoutes } from '@/lib/resource';
import { objAttrbtPrevilegesService } from '@/lib/entity/privileges/objAttrbtPrevileges.resource';

/** CI entity/obj_attrbt_previleges — list (?objId, scoped) and create. */
export const { GET, POST } = collectionRoutes(objAttrbtPrevilegesService);
