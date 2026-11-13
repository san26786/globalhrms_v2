import { NextResponse } from 'next/server';
import { withApi } from '@/lib/http/withApi';
import { empReports } from '@/lib/employeeMngt/empReports';

/** CI emp_mst/appraisal — GET: "Generate Appraisal Report" (appraisalReport_YYYYMMDD.csv, admins). */
export const GET = withApi(async ({ subject }) => {
  const file = await empReports.appraisalCsv(subject);
  return new NextResponse(new Uint8Array(file.data), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${file.name}"`, 'Cache-Control': 'private, no-store' },
  });
});
