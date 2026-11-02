import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NotFoundError, ServiceUnavailableError, ValidationError } from '@/lib/http/errors';

/**
 * Uploaded files kept on disk in a folder named by an environment variable (CI wrote them to public
 * folders under uploads/; point the variable at that folder, or a copy, so existing names resolve).
 * Files are only served through authenticated routes.
 */
export interface AttachmentStore {
  /** Environment variable holding the folder. */
  envVar: string;
  /** Lower-case extensions accepted. */
  allowed: ReadonlySet<string>;
  maxBytes: number;
  /** Longest stored name (the column's size). */
  maxNameLength: number;
}

function folder(store: AttachmentStore): string {
  const dir = process.env[store.envVar]?.trim();
  if (!dir) {
    throw new ServiceUnavailableError(
      `File storage is not configured: set ${store.envVar} to the folder for these attachments.`,
      'STORAGE_NOT_CONFIGURED',
    );
  }
  return dir;
}

/** CI upload(): the original name (spaces removed, unsafe characters → _), a numeric suffix when taken. */
export async function storeUpload(store: AttachmentStore, file: File, prefix: string, field = 'userFile'): Promise<string> {
  const original = path.basename(file.name).replace(/\s+/g, '');
  const ext = path.extname(original).slice(1).toLowerCase();
  if (!store.allowed.has(ext)) {
    throw new ValidationError('The filetype you are attempting to upload is not allowed.', {
      [field]: [`Allowed file types: ${[...store.allowed].join(', ')}.`],
    });
  }
  if (file.size > store.maxBytes) {
    throw new ValidationError(`The file you are attempting to upload is larger than ${Math.round(store.maxBytes / 1048576)} MB.`, {
      [field]: ['File too large.'],
    });
  }
  const dir = folder(store);
  await mkdir(dir, { recursive: true });
  const safe = original.slice(0, original.length - ext.length - 1).replace(/[^A-Za-z0-9._-]/g, '_') || 'file';
  // Room for the prefix, a numeric suffix and the extension within the column.
  const room = Math.max(1, store.maxNameLength - prefix.length - ext.length - 4);
  const base = `${prefix}${safe.slice(0, room)}`;
  for (let i = 0; i < 1000; i++) {
    const name = `${base}${i ? i : ''}.${ext}`;
    try {
      await access(path.join(dir, name));
    } catch {
      await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()), { flag: 'wx' });
      return name;
    }
  }
  throw new ValidationError('Could not store the file: too many files with this name.');
}

/** A stored file's bytes (the name is reduced to its base name — never a path from the database). */
export async function readStored(store: AttachmentStore, name: string): Promise<Buffer> {
  try {
    return await readFile(path.join(folder(store), path.basename(name)));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') throw new NotFoundError('Document Not Found!!');
    throw e;
  }
}
