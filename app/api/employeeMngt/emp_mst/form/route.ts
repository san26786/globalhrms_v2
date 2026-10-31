import { withApi } from '@/lib/http/withApi';
import { empMstService } from '@/lib/employeeMngt/empMst';

/** CI employeeMngt/emp_mst initForm — GET → dropdown options and which fields the caller may change. */
export const GET = withApi(async ({ subject }) => empMstService.form(subject));
