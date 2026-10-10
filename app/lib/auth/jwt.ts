import crypto from "crypto";
import jwt from "jsonwebtoken";
import { authConfig } from "./authConfig";

export interface AccessTokenPayload {
  sub: string;
  username: string;
  isAdmin: boolean;
  isSysAdmin: boolean;
  oaId: number | null;
  oaBrandId: number | null;
  /** concurrent_login_details.SESSION_ID of this login (CI session my_session_id). */
  sid?: string;
  /** ISO time of the login BEFORE this one (CI session lastLoginAt, shown as "Logged in at"). */
  pla?: string | null;
}

export interface RefreshTokenPayload {
  sub: string;
  sid?: string;
  /** Carried so a refreshed access token keeps the previous-login time. */
  pla?: string | null;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, authConfig.accessTokenSecret, {
    expiresIn: authConfig.accessTokenExpiresInSeconds,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    return jwt.verify(token, authConfig.accessTokenSecret) as AccessTokenPayload;
  } catch {
    return null;
  }
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, authConfig.refreshTokenSecret, {
    expiresIn: authConfig.refreshTokenExpiresInSeconds,
    // Unique per token: rotation may sign twice within one second (TOKEN_HASH is unique).
    jwtid: crypto.randomUUID(),
  });
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    return jwt.verify(token, authConfig.refreshTokenSecret) as RefreshTokenPayload;
  } catch {
    return null;
  }
}