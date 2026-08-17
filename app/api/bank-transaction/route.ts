import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/* ==========================================
   GET : List Bank Transactions with Filters
   ========================================== */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");
    const type = searchParams.get("type");
    const fyId = searchParams.get("fyId");
    const month = searchParams.get("month"); // e.g. "01" (Jan), "02" (Feb)

    // Build the query where clause
    const whereClause: any = {
      IS_DELETED: false,
    };

    if (accountId) {
      whereClause.ACCOUNT_ID = parseInt(accountId);
    }
    if (type) {
      whereClause.ACCOUNTING_TRANSACTION_TYPE = type;
    }
    if (fyId) {
      whereClause.FY_ID = parseInt(fyId);
    }

    // Fetch transactions from the database
    const transactions = await prisma.banksheet.findMany({
      where: whereClause,
      orderBy: {
        ID: "desc",
      },
    });

    // Fetch all bank details to map account names & numbers
    const bankDetails = await prisma.bankdetails.findMany({
      where: { IS_DELETED: 0 },
    });
    const bankDetailsMap = new Map(bankDetails.map((b: any) => [b.BANK_ID, b]));

    // Map and filter by month if specified (since TRANSACTION_DATE is stored as VarChar string)
    let mappedTransactions = transactions.map((t: any) => {
      const account = bankDetailsMap.get(t.ACCOUNT_ID) as any;
      return {
        ...t,
        ACCOUNT_NM: account ? account.ACCOUNT_NM : t.ACCOUNT_NM,
        ACCOUNT_NO: account ? account.ACCOUNT_NO : t.ACCOUNT_NO,
        BANK_NAME: account ? account.BANK_NAME : "",
      };
    });

    if (month) {
      mappedTransactions = mappedTransactions.filter((t: any) => {
        // Handle various string date formats (e.g. YYYY-MM-DD or DD/MM/YYYY)
        const dateStr = t.TRANSACTION_DATE;
        if (!dateStr) return false;
        
        // Match standard format parts
        const parts = dateStr.split(/[-/]/);
        if (parts.length >= 2) {
          // If YYYY-MM-DD, index 1 is month
          // If DD-MM-YYYY, index 1 is month
          // If MM-DD-YYYY, index 0 is month
          // Let's check both positions
          const parsedMonth = parseInt(parts[1]);
          const expectedMonth = parseInt(month);
          if (parsedMonth === expectedMonth) return true;
        }
        return false;
      });
    }

    return NextResponse.json({
      success: true,
      data: mappedTransactions,
    });
  } catch (error) {
    console.error("Failed to fetch bank transactions:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch Bank Transactions.",
      },
      { status: 500 }
    );
  }
}

/* ==========================================
   POST : Create Bank Transaction
   ========================================== */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const dateStr = body.transaction_date || new Date().toISOString().split("T")[0];
    
    // Resolve debit/credit logic
    const debitAmount = body.debit_amount || "0";
    const creditAmount = body.credit_amount || "0";
    const transType = body.accounting_transaction_type || (debitAmount !== "0" ? "BTTO" : "BTTI");

    const newTransaction = await prisma.banksheet.create({
      data: {
        TRANSACTION_DATE: dateStr,
        TRANSACTION_STATUS: Number(body.transaction_status || 1), // 1: Unexplained/Pending
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
        IS_DELETED: false,
        OA_ID: Number(body.oa_id || 1),
        OA_BRAND_ID: Number(body.oa_brand_id || 1),
        USER_ID: Number(body.user_id || 1),
        CREATED_BY: Number(body.user_id || 1),
        UPDATED_BY: Number(body.user_id || 1),
        CREATED_ON: new Date(),
        UPDATED_ON: new Date(),
        FY_ID: body.fy_id ? Number(body.fy_id) : null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Bank transaction created successfully.",
        data: newTransaction,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create bank transaction:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to create Bank Transaction.",
      },
      { status: 500 }
    );
  }
}
