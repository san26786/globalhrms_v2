import { collectionRoutes } from '@/lib/resource';
import { objMppngService } from '@/lib/entity/mapping/objMppng.resource';

/** CI entity/obj_mppng — list (?srcObjId / ?trgtObjId) and create. */
export const { GET, POST } = collectionRoutes(objMppngService);
