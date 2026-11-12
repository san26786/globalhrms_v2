import { ok } from '@/lib/http/respond';
import { readQuery, withApi } from '@/lib/http/withApi';
import { payrollRun } from '@/lib/payroll/run/service';

/**
 * CI getAbsentDays / getIncentive / getLoanInstallments / getAdvanceSalary / getAdvanceSalRepayment — GET
 * ?emp=&monthYear=MM/YYYY: the "More Options" figures of one employee (admins with the add grant).
 */
export const GET = withApi(async ({ req, subject }) => {
  const q = readQuery(req);
  return ok(await payrollRun.inputs(subject, { emp: q.emp, monthYear: q.monthYear }));
});
