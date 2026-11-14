import { ok } from '@/lib/http/respond';
import { withApi } from '@/lib/http/withApi';
import { resetSection, saveSection } from '@/lib/payroll/declarations/declarationService';

/**
 * One section of a declaration, by its code (IPCCD, IPCTN, IPME, DDTYPE, SEC80, IPEE, IPIITS, IPOAH, IPRE):
 * POST multipart saves it (CI update<Section>: its fields, `file` / `file_<row>` pictures), DELETE resets it
 * (CI delete<Section>); both roll the header up.
 */
export const POST = withApi<{ id: string; section: string }>(async ({ req, params, subject }) => {
  const result = await saveSection(subject, params.id, params.section, await req.formData());
  return ok(result, { message: result.message });
});

export const DELETE = withApi<{ id: string; section: string }>(async ({ params, subject }) => {
  const result = await resetSection(subject, params.id, params.section);
  return ok(result, { message: result.message });
});
