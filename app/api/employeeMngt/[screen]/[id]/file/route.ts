import { NextResponse } from 'next/server';
import { ok } from '@/lib/http/respond';
import { withApi } from '@/lib/http/withApi';
import { hubFor } from '@/lib/employeeMngt/hub/registry';

/**
 * An Employee Hub record's attachment (Regulatory Requirement): GET downloads it (CI: a public link to
 * its uploads folder), POST multipart `file` attaches / replaces it, DELETE detaches it.
 */
export const GET = withApi<{ screen: string; id: string }>(async ({ params, subject }) => {
  const { name, data, contentType } = await hubFor(params.screen).attachment(subject, params.id);
  const filename = name.replace(/["\r\n]/g, '');
  // Pictures whose bytes are a real image are shown inline (locked down); everything else downloads.
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

export const POST = withApi<{ screen: string; id: string }>(async ({ req, params, subject }) => {
  const form = await req.formData();
  const result = await hubFor(params.screen).upload(subject, params.id, form.get('file'));
  return ok(result, { message: 'Attachment uploaded.' });
});

export const DELETE = withApi<{ screen: string; id: string }>(async ({ params, subject }) => {
  const result = await hubFor(params.screen).removeAttachment(subject, params.id);
  return ok(result, { message: 'Attachment removed.' });
});
