import { NextResponse } from 'next/server';
import { NotFoundError } from '@/lib/http/errors';
import { ok } from '@/lib/http/respond';
import { withApi } from '@/lib/http/withApi';
import { exitDocumentService, isExitDocument } from '@/lib/employeeMngt/exitDocuments';

/**
 * An exit clearance's PDFs (CI department_activity/human_resource::generate* / previewExitForm and
 * department_head_supervisor::download*):
 *   GET  …/{id}/{exit-form|relieving-order|experience-letter} → the PDF
 *   POST …/{id}/exit-form → generate the exit form (admins)
 */
export const GET = withApi<{ id: string; document: string }>(async ({ params, subject }) => {
  if (!isExitDocument(params.document)) throw new NotFoundError();
  const { name, data } = await exitDocumentService.render(subject, params.id, params.document);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${name}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
});

export const POST = withApi<{ id: string; document: string }>(async ({ params, subject }) => {
  if (params.document !== 'exit-form') throw new NotFoundError();
  const result = await exitDocumentService.generate(subject, params.id);
  return ok(result, { message: result.message });
});
