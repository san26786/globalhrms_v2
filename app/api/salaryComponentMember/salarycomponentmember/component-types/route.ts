import { withApi } from '@/lib/http/withApi';
import { componentTypeDefaults } from '@/lib/salaryComponentMember/salaryComponentMember.resource';

/** GET — member component → Component Type from the brand's Salary Component settings (form default). */
export const GET = withApi(async ({ subject }) => componentTypeDefaults(subject));
