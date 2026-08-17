const isProduction = process.env.NODE_ENV === "production";

export const authConfig = {
  accessTokenSecret: process.env.JWT_ACCESS_SECRET!,
  refreshTokenSecret: process.env.JWT_REFRESH_SECRET!,

  accessTokenExpiresInSeconds: 15 * 60,               // 15 minutes
  refreshTokenExpiresInDays: 7,
  get refreshTokenExpiresInSeconds() {
    return this.refreshTokenExpiresInDays * 24 * 60 * 60;
  },

  accessTokenCookie: "globalhr_access_token",
  refreshTokenCookie: "globalhr_refresh_token",

  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
  },
};