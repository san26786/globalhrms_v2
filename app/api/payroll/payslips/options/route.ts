import { ok } from '@/lib/http/respond';
import { withApi } from '@/lib/http/withApi';
import { payrollRun } from '@/lib/payroll/run/service';

/** Payroll Processing's Generate Salary dialog — GET: the brand's employees, the default month, what the caller may do. */
export const GET = withApi(async ({ subject }) => ok(await payrollRun.options(subject)));
