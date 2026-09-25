import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateUser } from "@/lib/auth/auth-service";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { createSession } from "@/lib/auth/session-repository";
import { authConfig } from "@/lib/auth/authConfig";
import { fail } from "@/lib/http/respond";
import { readJson, withPublicApi } from "@/lib/http/withApi";
import { assertRateLimit, clientKey } from "@/lib/http/rateLimit";
import { getBrandContext } from "@/lib/session/brandContext";
import { resolveCiUrl } from "@/lib/navigation/routeRegistry";

/** CI login/login/userlogin: username + password required and trimmed. */
const loginSchema = z.object({
  usernameOrEmail: z.string().trim().min(1, "Username/email is required."),
  password: z.string().min(1, "Password is required."),
});

/**
 * CI login landing: admins → brand application's dashboard_mapping URL (else dashboard/dashboard);
 * employees → employeeMngt/emp_mst/myInfo. Screens not migrated yet fall back to the dashboard.
 */
async function landingPath(user: { isAdmin: boolean; isSysAdmin: boolean; oaBrandId: number | null }): Promise<string> {
  const ciTarget =
    user.isAdmin || user.isSysAdmin
      ? (user.oaBrandId ? (await getBrandContext(user.oaBrandId).catch(() => null))?.dashboardUrl : null) ?? "dashboard/dashboard"
      : "employeeMngt/emp_mst/myInfo";
  const resolved = resolveCiUrl(ciTarget);
  return resolved.kind === "internal" ? resolved.href : "/dashboard";
}

function clientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : req.headers.get("x-real-ip");
}

export const POST = withPublicApi(async ({ req }) => {
  // Per-client throttle on top of the per-account lock (CI had no rate limiting at all).
  assertRateLimit(`login:${clientKey(req)}`, 20, 15 * 60_000);
  const { usernameOrEmail, password } = loginSchema.parse(await readJson(req));

  const result = await authenticateUser(usernameOrEmail, password, {
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
  });
  if (!result.ok) {
    return fail(result.code === "INVALID" ? 401 : 403, result.message, result.code);
  }

  const { user } = result;
  const accessToken = signAccessToken({
    sub: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
    isSysAdmin: user.isSysAdmin,
    oaId: user.oaId,
    oaBrandId: user.oaBrandId,
    sid: user.sid,
    pla: user.previousLoginAt,
  });
  const refreshToken = signRefreshToken({ sub: user.id, sid: user.sid, pla: user.previousLoginAt });
  await createSession(user.userId, refreshToken);

  const response = NextResponse.json({
    success: true,
    message: "LOGIN SUCCESSFUL. WELCOME.",
    notice: result.notice,
    // CI: forced password change on first login (grace period) → user/changepassword.
    redirectTo: result.forcePasswordChange ? "/user/changepassword" : await landingPath(user),
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isAdmin: user.isAdmin,
      isSysAdmin: user.isSysAdmin,
      previousLoginAt: user.previousLoginAt,
      autoLogoutMs: user.autoLogoutMs,
    },
  });

  response.cookies.set(authConfig.accessTokenCookie, accessToken, {
    ...authConfig.cookie,
    maxAge: authConfig.accessTokenExpiresInSeconds,
  });
  response.cookies.set(authConfig.refreshTokenCookie, refreshToken, {
    ...authConfig.cookie,
    maxAge: authConfig.refreshTokenExpiresInSeconds,
  });
  // A fresh login starts in the user's home brand; drop any brand choice left from an earlier session.
  response.cookies.delete(authConfig.activeBrandCookie);
  return response;
});
