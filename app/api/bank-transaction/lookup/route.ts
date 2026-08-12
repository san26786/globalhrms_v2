import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Fetch Bank Accounts from bankdetails table
    const bankAccounts = await prisma.bankdetails.findMany({
      where: { IS_DELETED: 0 },
      select: {
        BANK_ID: true,
        BANK_NAME: true,
        ACCOUNT_NM: true,
        ACCOUNT_NO: true,
      },
      orderBy: {
        ACCOUNT_NM: "asc",
      },
    });

    // Resolve Bank Names if possible from independent_mst and deduplicate by BANK_ID
    const seenBankIds = new Set<string>();
    const bankDetailsList: { label: string; value: string }[] = [];
    
    for (const b of bankAccounts) {
      const val = String(b.BANK_ID);
      if (!seenBankIds.has(val)) {
        seenBankIds.add(val);
        bankDetailsList.push({
          label: `${b.ACCOUNT_NM} (${b.ACCOUNT_NO})`,
          value: val,
        });
      }
    }

    // 2. Fetch distinct Financial Years (FY_ID) from banksheet, or list typical ones
    const distinctFys = await prisma.banksheet.findMany({
      where: { IS_DELETED: false },
      select: { FY_ID: true },
      distinct: ["FY_ID"],
    });

    const activeFys = distinctFys
      .map((f: any) => f.FY_ID)
      .filter((f: any): f is number => f !== null && f !== undefined);

    // Standard fallback financial years
    const defaultFys = [
      { label: "2023-2024", value: "2023" },
      { label: "2024-2025", value: "2024" },
      { label: "2025-2026", value: "2025" },
      { label: "2026-2027", value: "2026" },
      { label: "2027-2028", value: "2027" },
    ];

    // Merge DB financial years if any, with fallback default list
    const finalFys = activeFys.length > 0 
      ? activeFys.map((fy: any) => ({ label: `FY ${fy}-${fy + 1}`, value: String(fy) }))
      : defaultFys;

    // 3. Transaction Types
    const transactionTypes = [
      { label: "Incoming / Receipt (Credit)", value: "BTTI" },
      { label: "Outgoing / Payment (Debit)", value: "BTTO" },
    ];

    // 4. Months list
    const months = [
      { label: "January", value: "01" },
      { label: "February", value: "02" },
      { label: "March", value: "03" },
      { label: "April", value: "04" },
      { label: "May", value: "05" },
      { label: "June", value: "06" },
      { label: "July", value: "07" },
      { label: "August", value: "08" },
      { label: "September", value: "09" },
      { label: "October", value: "10" },
      { label: "November", value: "11" },
      { label: "December", value: "12" },
    ];

    return NextResponse.json({
      success: true,
      bankAccounts: bankDetailsList,
      financialYears: finalFys,
      transactionTypes,
      months,
    });
  } catch (error) {
    console.error("Failed to fetch transaction lookup details:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch lookup data." },
      { status: 500 }
    );
  }
}
