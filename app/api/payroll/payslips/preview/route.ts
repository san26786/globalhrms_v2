import { NextResponse } from 'next/server';
import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { payrollRun } from '@/lib/payroll/run/service';

/**
 * CI generateSalaryDetails with isTemp = 1 (Generate Salary → Preview) — POST, same body as /generate with one
 * employee: the payslip PDF as it would be generated (nothing is saved), or JSON with the reason it would be skipped.
 */
export const POST = withApi(async ({ req, subject }) => {
  const result = await payrollRun.preview(subject, await readJson(req));
  if ('results' in result) return ok(result, { message: result.message });
  return new NextResponse(new Uint8Array(result.pdf.data), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${result.pdf.name}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
});
