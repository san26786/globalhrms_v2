import { itemRoutes } from '@/lib/resource';
import { entityObjService } from '@/lib/entity/entityObj/entityObj.resource';

/** CI entity/entity_obj — read, update, delete (soft; refused while attributes exist). */
export const { GET, PUT, DELETE } = itemRoutes(entityObjService);
