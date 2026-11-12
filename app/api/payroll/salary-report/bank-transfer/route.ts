import { NextResponse } from 'next/server';
import { readQuery, withApi } from '@/lib/http/withApi';
import { bankTransferWorkbook } from '@/lib/payroll/salaryReport/bankTransfer';
import { MIME_TYPES } from '@/lib/utils/constants';

/**
 * CI emp_sal_component_mst::exportExcel — GET ?monthYear=MM/YYYY[&emp=][&paid=0|1]: "Salary Bank Transfer Report.xlsx".
 * Payslips left out of the file (no bank account, net pay 0 or less) are listed in the X-Excluded header (JSON).
 */
export const GET = withApi(async ({ req, subject }) => {
  const { name, data, excluded } = await bankTransferWorkbook(subject, readQuery(req));
  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': MIME_TYPES.xlsx,
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'private, no-store',
      'X-Excluded': JSON.stringify(excluded),
    },
  });
});
