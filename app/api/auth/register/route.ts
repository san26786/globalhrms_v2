import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";

// TODO verify: does 1 mean "active" in your USER_STATUS_ID lookup?
// Same open question as DEFAULT_ACTIVE_STATUS_ID in create-org.
const DEFAULT_ACTIVE_STATUS_ID = 1;

// user_mst has these NOT NULL with no database default, and the signup form
// collects none of them, so the route has to supply values.
const LEGACY_REQUIRED_DEFAULTS = {
  CONCURRENT_LOGIN_COUNT: 0,
  SUSPENSION_FAILED_LOGIN_ATTEMPTS: 5,
  FAILED_LOGIN_ATTEMPTS: 0,
  QUESTION_ONE: 0,
  QUESTION_TWO: 0,
  QUESTION_THREE: 0,
  ANSWER_ONE: "",
  ANSWER_TWO: "",
  ANSWER_THREE: "",
  NOTIFY_COUNT: 0,
  ACC_GROUP: 0,
  SUB_ACC_GROUP: 0,
};

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, email, orgCode, passcode, memorableWord } =
      body ?? {};

    if (!username || !password || !email || !orgCode) {
      return NextResponse.json(
        {
          success: false,
          message: "Username, password, email, and organisation code are required.",
        },
        { status: 400 }
      );
    }

    if (String(password).length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
        },
        { status: 400 }
      );
    }

    const normalizedUsername = String(username).trim();
    const normalizedEmail = String(email).trim();
    const normalizedOrgCode = String(orgCode).toUpperCase().trim();

    const org = await prisma.org_accounts.findFirst({
      where: { OA_CD: normalizedOrgCode, IS_DELETED: 0 },
      select: { OA_ID: true, OA_NM: true },
    });

    if (!org) {
      return NextResponse.json(
        {
          success: false,
          message: `Organisation code "${normalizedOrgCode}" was not found. Create the organisation first.`,
        },
        { status: 400 }
      );
    }

    const clash = await prisma.user_mst.findFirst({
      where: {
        AND: [
          {
            OR: [
              { USER_NAME: normalizedUsername },
              { REG_EMAIL_ID: normalizedEmail },
            ],
          },
          { OR: [{ IS_DELETED: false }, { IS_DELETED: null }] },
        ],
      },
      select: { USER_ID: true, USER_NAME: true },
    });

    if (clash) {
      const field =
        clash.USER_NAME === normalizedUsername ? "Username" : "Email address";

      return NextResponse.json(
        { success: false, message: `${field} is already registered.` },
        { status: 409 }
      );
    }

    // The first account created against an organisation becomes its admin,
    // which is what create-org's carryOver comment anticipates.
    const existingOrgUsers = await prisma.user_mst.count({
      where: {
        OA_ID: org.OA_ID,
        OR: [{ IS_DELETED: false }, { IS_DELETED: null }],
      },
    });

    const isFirstUserOfOrg = existingOrgUsers === 0;

    // TPIN is an integer column, so a passcode's leading zeros are not preserved.
    const parsedPasscode =
      passcode && /^\d{1,9}$/.test(String(passcode))
        ? Number(passcode)
        : null;

    const now = new Date();

    const user = await prisma.user_mst.create({
      data: {
        USER_NAME: normalizedUsername,
        REG_EMAIL_ID: normalizedEmail,
        PASSWORD: await hashPassword(String(password)),
        USER_STATUS_ID: DEFAULT_ACTIVE_STATUS_ID,
        OA_ID: org.OA_ID,
        IS_ADMIN: isFirstUserOfOrg,
        IS_SYSADMIN: false,
        IS_DELETED: false,
        IS_ONLINE: false,
        TPIN: parsedPasscode,
        MEMORABLE_WORD: memorableWord ? String(memorableWord).trim() : null,
        // NOT NULL with no default — must be set even though the user has never logged in.
        LAST_LOGIN_AT: now,
        CREATED_ON: now,
        ...LEGACY_REQUIRED_DEFAULTS,
      },
      select: {
        USER_ID: true,
        USER_NAME: true,
        REG_EMAIL_ID: true,
        IS_ADMIN: true,
        OA_ID: true,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: String(user.USER_ID),
        username: user.USER_NAME,
        email: user.REG_EMAIL_ID,
        isAdmin: user.IS_ADMIN,
        orgId: user.OA_ID,
        orgName: org.OA_NM,
      },
    });
  } catch (error) {
    console.error("Registration failed:", error);
    return NextResponse.json(
      { success: false, message: "Unable to create account." },
      { status: 500 }
    );
  }
}
