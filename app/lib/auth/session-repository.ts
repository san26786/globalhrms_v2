import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./authConfig";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number, refreshToken: string) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + authConfig.refreshTokenExpiresInDays);

  return prisma.auth_refresh_session.create({
    data: {
      USER_ID: userId,
      TOKEN_HASH: hashToken(refreshToken),
      EXPIRES_AT: expiresAt,
    },
  });
}

export async function findValidSession(refreshToken: string) {
  const session = await prisma.auth_refresh_session.findUnique({
    where: { TOKEN_HASH: hashToken(refreshToken) },
  });

  if (!session) return null;
  if (session.REVOKED_AT !== null) return null;
  if (session.EXPIRES_AT < new Date()) return null;

  return session;
}

export async function revokeSession(refreshToken: string) {
  // updateMany: a missing/already-revoked row is not an error (logout must always succeed).
  return prisma.auth_refresh_session.updateMany({
    where: { TOKEN_HASH: hashToken(refreshToken), REVOKED_AT: null },
    data: { REVOKED_AT: new Date() },
  });
}

export async function revokeAllSessionsForUser(userId: number) {
  return prisma.auth_refresh_session.updateMany({
    where: { USER_ID: userId, REVOKED_AT: null },
    data: { REVOKED_AT: new Date() },
  });
}