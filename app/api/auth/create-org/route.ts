import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// TODO verify: does 1 mean "active" for OA_STATUS_ID in your status lookup?
// Swap this constant once confirmed.
const DEFAULT_ACTIVE_STATUS_ID = 1;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      code,
      name,
      email,
      country,
      contact,
      website,
      // subscription is intentionally not persisted — OA_ACC_TYPE mapping is unconfirmed
      passcode,
      memorableWord,
    } = body ?? {};

    if (!code || !name || !email || !contact) {
      return NextResponse.json(
        { success: false, message: "Organisation code, name, email, and contact number are required." },
        { status: 400 }
      );
    }

    const normalizedCode = String(code).toUpperCase().trim();

    if (normalizedCode.length > 10) {
      return NextResponse.json(
        { success: false, message: "Organisation code must be 10 characters or fewer." },
        { status: 400 }
      );
    }

    const existing = await prisma.org_accounts.findFirst({
      where: { OA_CD: normalizedCode, IS_DELETED: 0 },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: `Organisation Code "${normalizedCode}" is already registered.` },
        { status: 409 }
      );
    }

    // No dedicated country column — folded into the address field for now.
    const address = country ? `${country}` : "";

    const org = await prisma.org_accounts.create({
      data: {
        OA_CD: normalizedCode,
        OA_NM: name,
        OA_EMAIL: email,
        OA_WEB_DOMAIN: website ?? "",
        OA_CONTACT_NO: contact,
        OA_ADDRESS: address,
        OA_STATUS_ID: DEFAULT_ACTIVE_STATUS_ID,
        OA_ACC_TYPE: null,
        IS_DELETED: 0,
        CREATED_ON: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      org: {
        id: org.OA_ID,
        code: org.OA_CD,
        name: org.OA_NM,
      },
      // Carried forward so the Register form can pre-fill the org's first
      // admin account with the same passcode/memorable word the org form
      // collected — since org_accounts has nowhere to store these itself.
      carryOver: {
        passcode: passcode ?? null,
        memorableWord: memorableWord ?? null,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, message: "Unable to create organisation." },
      { status: 500 }
    );
  }
}