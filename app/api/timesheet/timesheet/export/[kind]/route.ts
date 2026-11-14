import { NotFoundError } from '@/lib/http/errors';
import { readQuery, withApi } from '@/lib/http/withApi';
import { exportCsv } from '@/lib/timesheet/timesheetBlock';

/**
 * GET /api/timesheet/timesheet/export/{hours|details}?month=YYYY-MM — CI exportTimesheetHours /
 * exportTimesheetDetail: a CSV download of the brand's month (administrators).
 */
export const dynamic = 'force-dynamic';

export const GET = withApi<{ kind: string }>(async ({ req, params, subject }) => {
  if (params.kind !== 'hours' && params.kind !== 'details') throw new NotFoundError('Unknown export.');
  const { filename, csv } = await exportCsv(subject, params.kind, readQuery(req));
  return new Response(`\uFEFF${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename.replace(/["\\]/g, '')}"`,
      'Cache-Control': 'no-store',
    },
  });
});
