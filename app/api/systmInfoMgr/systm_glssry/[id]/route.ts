import { itemRoutes } from '@/lib/resource';
import { systmGlossaryService } from '@/lib/systmInfoMgr/systmGlossary.resource';

/** CI systmInfoMgr/systm_glssry — read, update, delete (soft). */
export const { GET, PUT, DELETE } = itemRoutes(systmGlossaryService);
