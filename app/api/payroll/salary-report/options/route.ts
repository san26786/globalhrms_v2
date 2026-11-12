import { ok } from '@/lib/http/respond';
import { withApi } from '@/lib/http/withApi';
import { salaryReportOptions } from '@/lib/payroll/salaryReport/bankTransfer';

/** Salary Report toolbar — GET: { permissions: { markPaid, bankFile } }. */
export const GET = withApi(async ({ subject }) => ok(await salaryReportOptions(subject)));
