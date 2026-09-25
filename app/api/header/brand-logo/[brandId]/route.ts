import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { withApi } from '@/lib/http/withApi';
import { ValidationError } from '@/lib/http/errors';
import { findBrand } from '@/lib/header/header-repository';

/**
 * GET /api/header/brand-logo/:brandId — the brand's uploaded logo (CI images/organisationLogo/
 * {OA_BRAND_LOGO}). Uploaded files live outside the app bundle: set ORG_LOGO_DIR to the folder
 * holding them (the CI uploads folder or its copy). Missing folder/file → the CI default logo.
 */
const FALLBACK = '/images/organisationLogo/company_logo2.jpg';
const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  // SVG deliberately not served: an uploaded SVG opened directly on this origin could run script.
};

export const GET = withApi<{ brandId: string }>(async ({ req, params }) => {
  const brandId = Number(params.brandId);
  if (!Number.isInteger(brandId) || brandId <= 0) throw new ValidationError('Invalid brand.');

  const fallback = NextResponse.redirect(new URL(FALLBACK, req.url));
  const dir = process.env.ORG_LOGO_DIR?.trim();
  const brand = await findBrand(brandId);
  const file = brand?.OA_BRAND_LOGO ? path.basename(brand.OA_BRAND_LOGO) : null; // basename: no path traversal
  const type = file ? MIME[path.extname(file).toLowerCase()] : undefined;
  if (!dir || !file || !type) return fallback;

  try {
    const data = await readFile(path.join(dir, file));
    return new NextResponse(new Uint8Array(data), {
      headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch {
    return fallback;
  }
});
