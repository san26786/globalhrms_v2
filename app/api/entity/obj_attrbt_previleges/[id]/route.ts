import { itemRoutes } from '@/lib/resource';
import { objAttrbtPrevilegesService } from '@/lib/entity/privileges/objAttrbtPrevileges.resource';

/** CI entity/obj_attrbt_previleges — read, update, delete (soft). */
export const { GET, PUT, DELETE } = itemRoutes(objAttrbtPrevilegesService);
