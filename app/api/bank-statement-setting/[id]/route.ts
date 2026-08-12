import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/* ==========================================
   GET : Fetch settings and mappings for a specific bank
   ========================================== */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const bankId = Number(id);

    if (isNaN(bankId)) {
      return NextResponse.json(
        { success: false, message: "Invalid bank ID." },
        { status: 400 }
      );
    }

    // 1. Fetch mappings for this bank
    const mappings = await prisma.bank_csv_settings.findMany({
      where: { CSV_BANK: bankId, IS_DELETED: 0 },
      orderBy: { ID: "asc" },
    });

    // 2. Fetch single entry flag from bank_name_setting
    const nameSetting = await prisma.bank_name_setting.findFirst({
      where: { BANK_ID: bankId },
    });

    const singleEntryFlag = nameSetting ? nameSetting.SINGLE_ENTRY_FLAG : false;

    return NextResponse.json({
      success: true,
      data: {
        bankId,
        singleEntryFlag,
        mappings: mappings.map((m) => ({
          id: m.ID,
          csvColumn: m.CSV_BANK_STATEMENT_NM,
          dbColumn: m.DB_BANK_STATEMENT_NM,
          anotherDbColumn: m.ANOTHER_DB_BANK_STATEMENT_NM,
          crdbFlag: m.CRDB_FLAG,
        })),
      },
    });
  } catch (error) {
    console.error("Failed to fetch statement settings for bank:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch statement settings details." },
      { status: 500 }
    );
  }
}

/* ==========================================
   DELETE : Soft-delete a single statement mapping row by ID
   ========================================== */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const mappingId = Number(id);

    if (isNaN(mappingId)) {
      return NextResponse.json(
        { success: false, message: "Invalid mapping ID." },
        { status: 400 }
      );
    }

    // Update mapping record to be soft-deleted
    await prisma.bank_csv_settings.update({
      where: { ID: mappingId },
      data: { IS_DELETED: 1 },
    });

    return NextResponse.json({
      success: true,
      message: "Statement setting mapping deleted successfully.",
    });
  } catch (error) {
    console.error("Failed to delete statement mapping:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete statement mapping." },
      { status: 500 }
    );
  }
}
