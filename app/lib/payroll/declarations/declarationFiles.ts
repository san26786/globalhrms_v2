import { readdir, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { readStored, storeUpload, type AttachmentStore } from '@/lib/files/attachmentStore';
import { imageInfo } from '@/lib/files/imageInfo';
import { ServiceUnavailableError, ValidationError } from '@/lib/http/errors';

/**
 * The declaration sections' attachments (CI do_upload / medical_Upload into uploads/file_attachment/): pictures only
 * (gif, jpg, png). Donations, NPS, 80DD and 80U: at most 1000 KB and 1024 × 768 pixels; each Medical Expenses row:
 * at most 5000 KB and 2000 × 2000. Files are served only through the authenticated declarations route.
 *
 * Storage: DECLARATION_ATTACHMENT_DIR (point it at CI's uploads/file_attachment so the names CI stored resolve). A
 * new file is named "inv{declaration}_{slot}_{original}" — slot don / nps / dd / dis / med{row id}. Only
 * donations_details has an ATTACHMENT column in the live schema; the other sections' files are found by that name
 * (the newest), and a table that gains an ATTACHMENT column is written and read through it as well.
 *
 * Behaviour changes: a refused file is an error and nothing is saved (CI saved the name of a file it had refused);
 * names are unique per declaration (CI kept the original name with overwrite on, so two employees' "receipt.jpg"
 * replaced each other); a reset section's files are renamed "removed_…" so they no longer show (CI left the files).
 */
const ENV = 'DECLARATION_ATTACHMENT_DIR';
const ALLOWED = new Set(['gif', 'jpg', 'png']);

export type SlotKind = 'single' | 'medical';

const STORES: Record<SlotKind, AttachmentStore & { maxWidth: number; maxHeight: number }> = {
  single: { envVar: ENV, allowed: ALLOWED, maxBytes: 1000 * 1024, maxNameLength: 255, maxWidth: 1024, maxHeight: 768 },
  medical: { envVar: ENV, allowed: ALLOWED, maxBytes: 5000 * 1024, maxNameLength: 255, maxWidth: 2000, maxHeight: 2000 },
};

/** don | nps | dd | dis | med{EL_ID} */
export type Slot = 'don' | 'nps' | 'dd' | 'dis' | `med${number}`;

export const slotPrefix = (investmentId: number, slot: Slot) => `inv${investmentId}_${slot}_`;

function folder(): string {
  const dir = process.env[ENV]?.trim();
  if (!dir) throw new ServiceUnavailableError(`File storage is not configured: set ${ENV} to the folder for these attachments.`, 'STORAGE_NOT_CONFIGURED');
  return dir;
}

/** CI's upload checks (type, size, pixel size) before anything is saved; `field` names the form field in the error. */
export async function checkUpload(file: unknown, kind: SlotKind, field: string): Promise<File | null> {
  if (!(file instanceof File) || !file.size) return null;
  const store = STORES[kind];
  const ext = path.extname(file.name).slice(1).toLowerCase();
  if (!store.allowed.has(ext)) {
    throw new ValidationError('The filetype you are attempting to upload is not allowed.', { [field]: ['Allowed file types: gif, jpg, png.'] });
  }
  if (file.size > store.maxBytes) {
    throw new ValidationError(`The file you are attempting to upload is larger than ${store.maxBytes / 1024} KB.`, { [field]: ['File too large.'] });
  }
  const info = imageInfo(Buffer.from(await file.arrayBuffer()));
  if (!info || info.kind === 'bmp') throw new ValidationError('The uploaded file is not a valid image.', { [field]: ['The uploaded file is not a valid image.'] });
  if (info.width > store.maxWidth || info.height > store.maxHeight) {
    throw new ValidationError(`The image you are attempting to upload doesn't fit into the allowed dimensions (${store.maxWidth} × ${store.maxHeight}).`, {
      [field]: ['Image too large.'],
    });
  }
  return file;
}

/** Stores a checked file for the slot; returns the stored name. */
export function storeSlotFile(investmentId: number, slot: Slot, file: File, kind: SlotKind): Promise<string> {
  return storeUpload(STORES[kind], file, slotPrefix(investmentId, slot), 'file');
}

/** The slots' newest stored files, null when none (also when storage is not configured) — one directory read. */
export async function findSlotFiles(investmentId: number, slots: Slot[]): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  const dir = process.env[ENV]?.trim();
  let names: string[] = [];
  if (dir) names = await readdir(dir).catch(() => []);
  for (const slot of slots) {
    const prefix = slotPrefix(investmentId, slot);
    const mine = names.filter((n) => n.startsWith(prefix));
    if (!mine.length) {
      out[slot] = null;
      continue;
    }
    const dated = await Promise.all(mine.map(async (n) => ({ n, t: (await stat(path.join(dir!, n)).catch(() => null))?.mtimeMs ?? 0 })));
    dated.sort((a, b) => b.t - a.t || b.n.localeCompare(a.n));
    out[slot] = dated[0].n;
  }
  return out;
}

/** A reset section's files no longer show: renamed "removed_…" (CI never deleted uploads). */
export async function detachSlotFiles(investmentId: number, slot: Slot): Promise<void> {
  const dir = process.env[ENV]?.trim();
  if (!dir) return;
  const prefix = slotPrefix(investmentId, slot);
  const names = (await readdir(dir).catch(() => [] as string[])).filter((n) => n.startsWith(prefix));
  for (const n of names) {
    await rename(path.join(dir, n), path.join(dir, `removed_${Date.now()}_${n}`)).catch(() => undefined);
  }
}

/** A stored file's bytes and the picture type to show it inline with (else it downloads). */
export async function readDeclarationFile(name: string): Promise<{ data: Buffer; contentType: string | null }> {
  folder();
  const data = await readStored(STORES.single, name);
  return { data, contentType: imageInfo(data)?.mime ?? null };
}
