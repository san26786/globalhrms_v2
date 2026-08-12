import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ==========================================
   GET : Retrieve specific Bank Transaction
   ========================================== */
export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const transactionId = parseInt(id);
    if (isNaN(transactionId)) {
      return NextResponse.json({ success: false, message: "Invalid ID" }, { status: 400 });
    }

    const transaction = await prisma.banksheet.findFirst({
      where: {
        ID: transactionId,
        IS_DELETED: false,
      },
    });

    if (!transaction) {
      return NextResponse.json({ success: false, message: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: transaction });
  } catch (error) {
    console.error("Failed to fetch bank transaction:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

/* ==========================================
   PUT : Update Bank Transaction
   ========================================== */
export async function PUT(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const transactionId = parseInt(id);
    if (isNaN(transactionId)) {
      return NextResponse.json({ success: false, message: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json();

    const debitAmount = body.debit_amount || "0";
    const creditAmount = body.credit_amount || "0";
    const transType = body.accounting_transaction_type || (debitAmount !== "0" ? "BTTO" : "BTTI");

    const updatedTransaction = await prisma.banksheet.update({
      where: { ID: transactionId },
      data: {
        TRANSACTION_DATE: body.transaction_date,
        TRANSACTION_STATUS: Number(body.transaction_status),
        PARTICULARS: body.particulars || "",
        CHQNO_REFNO: body.chqno_refno || "",
        CREDIT_AMOUNT: creditAmount,
        DEBIT_AMOUNT: debitAmount,
        CLOSING_BAL: body.closing_bal || "0",
        SOL: Number(body.sol || 0),
        ACCOUNTING_TRANSACTION_TYPE: transType,
        CATEGORY_TYPE: body.category_type || "",
        CATEGORY: body.category || "",
        NOTES: body.notes || "",
        TRANSACTION_TYPE: transType === "BTTI" ? "Credit" : "Debit",
        SORT_CODE: body.sort_code || "",
        DESCRIPTION: body.description || "",
        VALUE: body.value || "0",
        ACCOUNT_NM: body.account_nm || "",
        ACCOUNT_NO: body.account_no || "",
        MSTR_ID: Number(body.mstr_id || 0),
        BANKID: Number(body.bank_id || body.account_id || 0),
        ACCOUNT_ID: Number(body.account_id || 0),
        ACCTYPE: Number(body.acctype || 0),
        ACCCAT: Number(body.acccat || 0),
        ACCDESC: body.accdesc || "",
        UPDATED_ON: new Date(),
        UPDATED_BY: Number(body.user_id || 1),
        FY_ID: body.fy_id ? Number(body.fy_id) : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Bank transaction updated successfully.",
      data: updatedTransaction,
    });
  } catch (error) {
    console.error("Failed to update bank transaction:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

/* ==========================================
   DELETE : Soft Delete Bank Transaction
   ========================================== */
export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const transactionId = parseInt(id);
    if (isNaN(transactionId)) {
      return NextResponse.json({ success: false, message: "Invalid ID" }, { status: 400 });
    }

    // Soft delete transaction
    await prisma.banksheet.update({
      where: { ID: transactionId },
      data: {
        IS_DELETED: true,
        UPDATED_ON: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Bank transaction deleted successfully.",
    });
  } catch (error) {
    console.error("Failed to delete bank transaction:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
