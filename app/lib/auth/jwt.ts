import jwt from "jsonwebtoken";
import { authConfig } from "./authConfig";

export interface AccessTokenPayload {
  sub: string;
  username: string;
  isAdmin: boolean;
  isSysAdmin: boolean;
  oaId: number | null;
  oaBrandId: number | null;
}

export interface RefreshTokenPayload {
  sub: string;
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
  });
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    return jwt.verify(token, authConfig.refreshTokenSecret) as RefreshTokenPayload;
  } catch {
    return null;
  }
}