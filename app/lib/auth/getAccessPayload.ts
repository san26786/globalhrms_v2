import type { NextRequest } from 'next/server';
import { authConfig } from '@/lib/auth/authConfig';
import { verifyAccessToken, type AccessTokenPayload } from '@/lib/auth/jwt';

/** Reads and verifies the access-token cookie. Null = missing, invalid or expired (caller returns 401). */
export function getAccessPayload(request: NextRequest): AccessTokenPayload | null {
  const token = request.cookies.get(authConfig.accessTokenCookie)?.value;
  return token ? verifyAccessToken(token) : null;
}

/** Access tokens issued before this change carry `oaBrandId` as a string ("12", or "null"). Accept both. */
export function toIntOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}
