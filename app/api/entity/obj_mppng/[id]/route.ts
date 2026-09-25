import { itemRoutes } from '@/lib/resource';
import { objMppngService } from '@/lib/entity/mapping/objMppng.resource';

/** CI entity/obj_mppng — read, update, delete (soft; refused while attribute mappings use it). */
export const { GET, PUT, DELETE } = itemRoutes(objMppngService);
