import { NextResponse } from 'next/server';
import { NotFoundError } from '@/lib/http/errors';
import { readQuery, withApi } from '@/lib/http/withApi';
import { fyMonthlyReport, fyMonthlyWorkbook, REPORT_FILE, REPORT_KINDS, type ReportKind } from '@/lib/payroll/reports/fyMonthly';
import { MIME_TYPES } from '@/lib/utils/constants';

/** CI professionalTaxExport / MonthlyGrossReportExport / MonthlyNetReportExport — GET ?fy=&emp=: the report as .xlsx. */
export const GET = withApi<{ kind: string }>(async ({ req, params, subject }) => {
  const kind = REPORT_KINDS.find((k) => k === params.kind) as ReportKind | undefined;
  if (!kind) throw new NotFoundError();
  const data = fyMonthlyWorkbook(await fyMonthlyReport(subject, kind, readQuery(req)));
  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': MIME_TYPES.xlsx,
      'Content-Disposition': `attachment; filename="${REPORT_FILE[kind]}.xlsx"`,
      'Cache-Control': 'private, no-store',
    },
  });
});
