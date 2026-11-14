import { NextResponse } from 'next/server';
import { readQuery, withApi } from '@/lib/http/withApi';
import { form16DocumentService } from '@/lib/payroll/form16/document';

/**
 * CI form16/form16 previewForm16 / generateForm16 — GET [?download=1][&period=&fy=]: the Form 16 PDF (inline to preview,
 * attachment to "generate"). `period` / `fy`: the form's Period / Financial Period (rules in lib/payroll/form16/document).
 */
export const GET = withApi<{ id: string }>(async ({ req, params, subject }) => {
  const query = readQuery(req);
  const { name, data } = await form16DocumentService.render(subject, params.id, { period: query.period || undefined, fy: query.fy || undefined });
  const disposition = query.download === '1' ? 'attachment' : 'inline';
  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${name}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
});
