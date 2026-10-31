import { created, ok } from '@/lib/http/respond';
import { readJson, readQuery, withApi } from '@/lib/http/withApi';
import { empListService } from '@/lib/employeeMngt/empList';
import { empMstService } from '@/lib/employeeMngt/empMst';

/**
 * CI employeeMngt/emp_mst — thin HTTP adapter (rules in lib/employeeMngt).
 *   GET ?screen=all|team&status&department&manager&page&limit&search&sort&dir → the employee list
 *   POST { …form } → CI insert()
 */
export const GET = withApi(async ({ req, subject }) => {
  const query = readQuery(req);
  const { rows, total, page, limit, permissions } = await empListService.list(subject, query.screen === 'team' ? 'team' : 'all', query);
  return ok(rows, { total, page, limit, permissions });
});

export const POST = withApi(async ({ req, subject }) => {
  const result = await empMstService.create(subject, await readJson(req));
  return created(result, { message: result.message });
});
