import { NextResponse } from 'next/server';
import { readQuery, withApi } from '@/lib/http/withApi';
import { taxBreakupWorkbook } from '@/lib/payroll/declarations/taxBreakup';
import { MIME_TYPES } from '@/lib/utils/constants';

/** CI emp_investment_declarations::exportTaxBreakup — GET ?fy=: the year's tax breakup per employee (.xlsx). */
export const GET = withApi(async ({ req, subject }) => {
  const { name, data } = await taxBreakupWorkbook(subject, readQuery(req).fy);
  return new NextResponse(new Uint8Array(data), {
    headers: { 'Content-Type': MIME_TYPES.xlsx, 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'private, no-store' },
  });
});
