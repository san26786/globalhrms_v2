import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/auth/auth-service";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { createSession } from "@/lib/auth/session-repository";
import { authConfig } from "@/lib/auth/authConfig";

export async function POST(request: NextRequest) {
  try {
    const { usernameOrEmail, password } = await request.json();

    if (!usernameOrEmail || !password) {
      return NextResponse.json(
        { success: false, message: "Username/email and password are required." },
        { status: 400 }
      );
    }

    const user = await authenticateUser(usernameOrEmail, password);

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Invalid username or password." },
        { status: 401 }
      );
    }

    const accessToken = signAccessToken({
      sub: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      isSysAdmin: user.isSysAdmin,
      oaBrandId: String(user.oaBrandId),
    });

    const refreshToken = signRefreshToken({ sub: user.id });
    await createSession(user.userId, refreshToken);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin,
        isSysAdmin: user.isSysAdmin,
      },
    });

    response.cookies.set(authConfig.accessTokenCookie, accessToken, {
      ...authConfig.cookie,
      maxAge: 15 * 60,
    });
    response.cookies.set(authConfig.refreshTokenCookie, refreshToken, {
      ...authConfig.cookie,
      maxAge: authConfig.refreshTokenExpiresInDays * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, message: "Login failed. Please try again." },
      { status: 500 }
    );
  }
}