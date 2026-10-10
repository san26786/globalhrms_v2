import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readJson, withApi } from '@/lib/http/withApi';
import { ForbiddenError, NotFoundError } from '@/lib/http/errors';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { ImportService } from '@/lib/import-export/ImportService';
import { moduleRegistry } from '@/lib/import-export/ModuleConfig';

export const dynamic = 'force-dynamic';

/**
 * POST /api/common/import { action: 'preview' | 'import', entity, rows[] } — the shared
 * ImportExportControls endpoint. Authenticated; bulk writes are an administrator function.
 *
 * Response shape is unchanged for the client: the preview / summary object at the top level
 * ({ success, totalRows, previews, … } / { success, inserted, updated, failed, … }); errors use the
 * standard envelope ({ success: false, message }).
 */
const bodySchema = z.object({
  action: z.enum(['preview', 'import'], { message: "Invalid action. Supported actions: 'preview', 'import'." }),
  entity: z.string().trim().min(1, "Missing required parameter: 'entity'.").max(100),
  rows: z.array(z.record(z.string(), z.unknown()), { message: "Missing required parameter: 'rows' (must be an array)." }).max(10_000),
});

export const POST = withApi(async ({ req, subject }) => {
  if (subject.adminLevel < 1) throw new ForbiddenError('Only administrators can import data.');
  const { action, entity, rows } = bodySchema.parse(await readJson(req));
  const config = moduleRegistry[entity];
  if (!config) throw new NotFoundError(`Entity configuration for "${entity}" is not registered.`);

  if (action === 'preview') {
    return NextResponse.json(await ImportService.generatePreview(entity, rows));
  }
  // Inserts rely on the table's id sequence; refuse instead of reusing existing ids.
  if (config.importPolicy !== 'update') await assertInsertSafe(config.table, config.primaryKey);
  return NextResponse.json(await ImportService.executeImport(entity, rows));
});
