import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ==========================================
   GET : List Bank Details
   ========================================== */
export async function GET() {
  try {
    const bankDetailsList = await prisma.bankdetails.findMany({
      where: {
        OR: [
          { IS_DELETED: 0 },
          { IS_DELETED: null }
        ]
      },
      orderBy: {
        BANK_ID: "asc",
      },
    });

    // 1. Fetch Bank Names (Type Code: SEBN)
    const sebnType = await prisma.common_type.findFirst({
      where: { TYP_CD: "SEBN" },
    });
    const bankNames = sebnType
      ? await prisma.independent_mst.findMany({
          where: { TYP_ID: sebnType.TYP_ID },
          select: { MSTR_ID: true, MSTR_NM: true },
        })
      : [];

    // 2. Fetch Account Types (Type Code: CTBAT)
    const ctbatType = await prisma.common_type.findFirst({
      where: { TYP_CD: "CTBAT" },
    });
    const accountTypes = ctbatType
      ? await prisma.independent_mst.findMany({
          where: { TYP_ID: ctbatType.TYP_ID },
          select: { MSTR_ID: true, MSTR_NM: true },
        })
      : [];

    const bankNameMap = new Map(bankNames.map((b) => [String(b.MSTR_ID), b.MSTR_NM]));
    const accountTypeMap = new Map(accountTypes.map((a) => [String(a.MSTR_ID), a.MSTR_NM]));

    // Map numerical values to names for the UI list display
    const mappedList = bankDetailsList.map((item) => {
      const bankName = bankNameMap.get(item.BANK_NAME) || item.BANK_NAME;
      const accountType = accountTypeMap.get(String(item.BANK_ACC_TYPE)) || String(item.BANK_ACC_TYPE);

      return {
        ...item,
        BANK_NAME: bankName,
        BANK_ACC_TYPE: accountType,
      };
    });

    return NextResponse.json({
      success: true,
      data: mappedList,
    });
  } catch (error) {
    console.error("Failed to fetch bank details:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch Bank Details.",
      },
      { status: 500 }
    );
  }
}

/* ==========================================
   POST : Create Bank Detail
   ========================================== */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const newBankDetail = await prisma.bankdetails.create({
      data: {
        BANK_ACC_TYPE: Number(body.bank_acc_type),
        BANK_NAME: body.bankname || "Default Bank",
        BRANCH_NM: body.branchname || "",
        ACCOUNT_NM: body.accountname || "",
        ACCOUNT_NO: body.accountno || "0000000000",
        BRANCH_CD: body.branchcode || "",
        IFSC_CD: body.ifsccode || "",
        MICR_CD: body.micrcode || "",
        ADDRESS: body.address || "",
        OPENING_BAL: body.opening_bal || "0",
        DEPOSITS: body.deposits || "0",
        WITHDRAWALS: body.withdrawals || "0",
        OA_ID: 1,         // default fallback
        OA_BRAND_ID: 1,   // default fallback
        USER_ID: 1,       // default fallback
        IS_DELETED: 0,
        CREATED_BY: 1,
        CREATED_ON: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Bank details created successfully.",
      data: newBankDetail,
    });
  } catch (error) {
    console.error("Failed to create bank detail:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create bank detail." },
      { status: 500 }
    );
  }
}
