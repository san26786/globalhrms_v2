import { collectionRoutes } from '@/lib/resource';
import { salaryComponentMemberService } from '@/lib/salaryComponentMember/salaryComponentMember.resource';

/** CI salaryComponentMember/salarycomponentmember — list and create. The screen lists via /api/listview/salary_component_member. */
export const { GET, POST } = collectionRoutes(salaryComponentMemberService);
