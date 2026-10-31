import { readQuery, withApi } from '@/lib/http/withApi';
import { empListService } from '@/lib/employeeMngt/empList';

/** CI employeeMngt/emp_mst customFields — GET ?screen=all|team → Employee Status / Department / Manager options. */
export const GET = withApi(async ({ req, subject }) => empListService.filters(subject, readQuery(req).screen === 'team' ? 'team' : 'all'));
