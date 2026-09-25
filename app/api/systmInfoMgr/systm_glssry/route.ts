import { collectionRoutes } from '@/lib/resource';
import { systmGlossaryService } from '@/lib/systmInfoMgr/systmGlossary.resource';

/** CI systmInfoMgr/systm_glssry — list (server-side paging/search/sort) and create. */
export const { GET, POST } = collectionRoutes(systmGlossaryService);
