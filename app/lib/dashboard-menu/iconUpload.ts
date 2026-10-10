/**
 * app/lib/dashboard-menu/iconUpload.ts
 *
 * Ports Dashboard_menu::uploadFile() / uploadFile1() / uploadFile2() — same
 * extension whitelist, same 10MB cap, same three physical destinations
 * under /img/<SMALL|MEDIUM|BLOCK>_..._ICON. One deliberate change: CI kept
 * the browser-supplied filename as-is (silently overwriting any existing
 * file of the same name); this generates a random filename per upload to
 * remove that collision risk. The DB still stores only a bare filename, so
 * nothing downstream needs to change.
 */

import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import {
  DASHBOARD_MENU_ALLOWED_ICON_EXTENSIONS,
  DASHBOARD_MENU_ICON_DIRS,
  DASHBOARD_MENU_MAX_ICON_BYTES,
} from './constants';

export type IconKind = keyof typeof DASHBOARD_MENU_ICON_DIRS; // 'small' | 'medium' | 'block'

export class IconUploadError extends Error {}

function extensionOf(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Validates and persists one uploaded icon file. Returns the stored
 * filename to save on the menu_config row, or null if no file was supplied
 * (caller falls back to the DASHBOARD_MENU_DEFAULT_ICONS constant, same as
 * CI's `if (empty($image)) { $image = '3.1.png'; }`).
 */
export async function saveIcon(file: File | null | undefined, kind: IconKind): Promise<string | null> {
  if (!file || file.size === 0) return null;

  const ext = extensionOf(file.name);
  if (!DASHBOARD_MENU_ALLOWED_ICON_EXTENSIONS.includes(ext as (typeof DASHBOARD_MENU_ALLOWED_ICON_EXTENSIONS)[number])) {
    throw new IconUploadError('File Format Not Allowed.');
  }
  if (file.size > DASHBOARD_MENU_MAX_ICON_BYTES) {
    throw new IconUploadError('File exceeds the 10MB upload limit.');
  }

  const dir = DASHBOARD_MENU_ICON_DIRS[kind];
  const destDir = path.join(process.cwd(), 'public', 'img', dir);
  await mkdir(destDir, { recursive: true });

  const storedName = `${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(destDir, storedName), buffer);

  return storedName;
}
