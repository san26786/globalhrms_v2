import { NextResponse } from 'next/server';
import { withApi } from '@/lib/http/withApi';
import { parseId } from '@/lib/systmMngt/shared';
import { companyDocumentsService as svc } from '@/lib/systmMngt/companyDocuments';

/** GET — the document's file as a download (CI: a public link to uploads/member_attachment/{file}). */
export const GET = withApi<{ id: string }>(async ({ params, subject }) => {
  const { name, data } = await svc.file(subject, parseId(params.id));
  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${name.replace(/"/g, '')}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
});
