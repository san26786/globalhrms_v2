import { NextResponse } from 'next/server';
import { readQuery, withApi } from '@/lib/http/withApi';
import { declarationAttachment } from '@/lib/payroll/declarations/declarationService';

/** A section's picture — GET ?slot=don | nps | dd | dis | med{row} (CI: a public link to uploads/file_attachment). */
export const GET = withApi<{ id: string }>(async ({ req, params, subject }) => {
  const { name, data, contentType } = await declarationAttachment(subject, params.id, readQuery(req).slot ?? '');
  const filename = name.replace(/["\r\n]/g, '');
  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': contentType ?? 'application/octet-stream',
      'Content-Disposition': `${contentType ? 'inline' : 'attachment'}; filename="${filename}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
      ...(contentType ? { 'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" } : {}),
    },
  });
});
