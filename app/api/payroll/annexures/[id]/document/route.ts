import { NextResponse } from 'next/server';
import { readQuery, withApi } from '@/lib/http/withApi';
import { annexureDocumentService } from '@/lib/payroll/annexure/document';

/** CI emp_sal_component_mst show_preview / downloadPaySlip of an annexure — GET [?download=1]: the annexure PDF of the header's pair. */
export const GET = withApi<{ id: string }>(async ({ req, params, subject }) => {
  const { name, data } = await annexureDocumentService.render(subject, params.id);
  const disposition = readQuery(req).download === '1' ? 'attachment' : 'inline';
  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${name}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
});
