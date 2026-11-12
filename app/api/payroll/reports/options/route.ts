import { ok } from '@/lib/http/respond';
import { readQuery, withApi } from '@/lib/http/withApi';
import { reportOptions } from '@/lib/payroll/reports/fyMonthly';

/** The payroll reports' filters — GET ?for=pt|gross|net|breakup: financial years, the default one, employees. */
export const GET = withApi(async ({ req, subject }) => ok(await reportOptions(subject, readQuery(req).for ?? '')));
