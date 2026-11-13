import { NextResponse } from 'next/server';
import { ValidationError } from '@/lib/http/errors';
import { readQuery, withApi } from '@/lib/http/withApi';
import { empReports } from '@/lib/employeeMngt/empReports';
import { MIME_TYPES } from '@/lib/utils/constants';

/**
 * CI emp_mst/export · export/createXLS(IOM) · emp_mst/pdf — GET ?format=csv|xlsx|pdf&date=YYYY-MM-DD[&screen=team]:
 * the Employee Status Report as of the list's date (admins).
 */
export const GET = withApi(async ({ req, subject }) => {
  const q = readQuery(req);
  const format = q.format ?? 'csv';
  const file = format === 'csv' ? await empReports.esrCsv(subject, q.screen === 'team' ? 'team' : 'all', q.date)
    : format === 'xlsx' ? await empReports.esrExcel(subject, q.date)
      : format === 'pdf' ? await empReports.esrPdf(subject, q.date)
        : null;
  if (!file) throw new ValidationError('Validation failed.', { format: ['Unknown report format.'] });
  const type = format === 'csv' ? 'text/csv; charset=utf-8' : format === 'xlsx' ? MIME_TYPES.xlsx : 'application/pdf';
  return new NextResponse(new Uint8Array(file.data), {
    headers: { 'Content-Type': type, 'Content-Disposition': `attachment; filename="${file.name}"`, 'Cache-Control': 'private, no-store' },
  });
});
