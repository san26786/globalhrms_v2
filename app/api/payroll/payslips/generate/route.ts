import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { payrollRun } from '@/lib/payroll/run/service';

/**
 * CI emp_sal_component_mst::generateSalaryDetails — POST { empIds: number[] | 'all', monthYear: 'MM/YYYY',
 * inputs?: { … one employee's More Options }, timesheetExceptions?: number[] } → per-employee results (admins).
 */
export const POST = withApi(async ({ req, subject }) => {
  const result = await payrollRun.generate(subject, await readJson(req));
  return ok(result, { message: result.message });
});
