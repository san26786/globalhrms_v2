import { NextResponse } from 'next/server';
import { readQuery, withApi } from '@/lib/http/withApi';
import { monthlyTaxWorkbook } from '@/lib/payroll/reports/monthlyTax';
import { MIME_TYPES } from '@/lib/utils/constants';

/** CI emp_investment_declarations::exportMonthlyTaxDeduction — GET ?fy=: the year's income tax deducted per month (.xlsx). */
export const GET = withApi(async ({ req, subject }) => {
  const { name, data } = await monthlyTaxWorkbook(subject, readQuery(req).fy);
  return new NextResponse(new Uint8Array(data), {
    headers: { 'Content-Type': MIME_TYPES.xlsx, 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'private, no-store' },
  });
});
