import { itemRoutes } from '@/lib/resource';
import { salaryComponentMemberService } from '@/lib/salaryComponentMember/salaryComponentMember.resource';

/** CI salaryComponentMember/salarycomponentmember — read, update, delete (soft). */
export const { GET, PUT, DELETE } = itemRoutes(salaryComponentMemberService);
