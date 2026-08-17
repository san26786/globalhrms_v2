import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const bankId = parseInt(id);
    if (isNaN(bankId)) {
      return NextResponse.json({ success: false, message: "Invalid ID" }, { status: 400 });
    }

    const bankDetail = await prisma.bankdetails.findUnique({
      where: { BANK_ID: bankId },
    });

    if (!bankDetail) {
      return NextResponse.json({ success: false, message: "Bank detail not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: bankDetail });
  } catch (error) {
    console.error("Failed to fetch bank detail:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const bankId = parseInt(id);
    if (isNaN(bankId)) {
      return NextResponse.json({ success: false, message: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json();

    const updatedBankDetail = await prisma.bankdetails.update({
      where: { BANK_ID: bankId },
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
        UPDATED_ON: new Date(),
        UPDATED_BY: 1, // default fallback
      },
    });

    return NextResponse.json({
      success: true,
      message: "Bank details updated successfully.",
      data: updatedBankDetail,
    });
  } catch (error) {
    console.error("Failed to update bank detail:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const bankId = parseInt(id);
    if (isNaN(bankId)) {
      return NextResponse.json({ success: false, message: "Invalid ID" }, { status: 400 });
    }

    await prisma.bankdetails.delete({
      where: { BANK_ID: bankId },
    });

    return NextResponse.json({
      success: true,
      message: "Bank detail deleted successfully.",
    });
  } catch (error) {
    console.error("Failed to delete bank detail:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
