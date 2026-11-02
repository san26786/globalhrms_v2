/**
 * The kind and pixel size of an uploaded image, read from its header bytes (no image library). Only the
 * formats browsers display safely: JPEG, PNG, GIF, BMP — never SVG / HTML.
 */
export interface ImageInfo {
  kind: 'jpeg' | 'png' | 'gif' | 'bmp';
  mime: string;
  width: number;
  height: number;
}

/** JPEG start-of-frame markers (baseline, progressive, …) carry the size. */
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function jpegSize(b: Buffer): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) { i += 1; continue; } // fill byte
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; } // no length
    if (SOF.has(marker)) return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

export function imageInfo(b: Buffer): ImageInfo | null {
  if (b.length >= 24 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { kind: 'png', mime: 'image/png', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  if (b.length >= 10 && /^GIF8[79]a$/.test(b.subarray(0, 6).toString('latin1'))) {
    return { kind: 'gif', mime: 'image/gif', width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
  }
  if (b.length >= 26 && b[0] === 0x42 && b[1] === 0x4d) {
    return { kind: 'bmp', mime: 'image/bmp', width: Math.abs(b.readInt32LE(18)), height: Math.abs(b.readInt32LE(22)) };
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    const size = jpegSize(b);
    return { kind: 'jpeg', mime: 'image/jpeg', width: size?.width ?? 0, height: size?.height ?? 0 };
  }
  return null;
}
