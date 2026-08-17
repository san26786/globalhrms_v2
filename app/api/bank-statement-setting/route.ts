import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/* ==========================================
   GET : List Bank Statement Settings
   ========================================== */
export async function GET() {
  try {
    // 1. Fetch active settings (IS_DELETED = 0)
    const settings = await prisma.bank_csv_settings.findMany({
      where: { IS_DELETED: 0 },
      orderBy: { ID: "desc" },
    });

    // 2. Fetch all bank names from independent_mst
    const sebnType = await prisma.common_type.findFirst({
      where: { TYP_CD: "SEBN" },
    });
    
    const bankNames = sebnType
      ? await prisma.independent_mst.findMany({
          where: { TYP_ID: sebnType.TYP_ID },
          select: { MSTR_ID: true, MSTR_NM: true },
        })
      : [];

    const bankNameMap = new Map(bankNames.map((b) => [b.MSTR_ID, b.MSTR_NM]));

    // 3. Fetch single entry flag settings from bank_name_setting
    const nameSettings = await prisma.bank_name_setting.findMany();
    const singleEntryMap = new Map(nameSettings.map((ns) => [ns.BANK_ID, ns.SINGLE_ENTRY_FLAG]));

    // 4. Map settings to return values containing bank names and single entry flags
    const mappedList = settings.map((item) => {
      const bankName = bankNameMap.get(item.CSV_BANK) || `Bank (ID: ${item.CSV_BANK})`;
      const singleEntryFlag = singleEntryMap.get(item.CSV_BANK) || false;
      return {
        id: item.ID,
        bankId: item.CSV_BANK,
        bankName,
        csvColumn: item.CSV_BANK_STATEMENT_NM,
        mappedColumn: item.DB_BANK_STATEMENT_NM,
        anotherMappedColumn: item.ANOTHER_DB_BANK_STATEMENT_NM,
        crdbFlag: item.CRDB_FLAG,
        singleEntryFlag,
      };
    });

    return NextResponse.json({
      success: true,
      data: mappedList,
    });
  } catch (error) {
    console.error("Failed to fetch statement settings:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch bank statement settings." },
      { status: 500 }
    );
  }
}

/* ==========================================
   POST : Create or Update Bank Statement Setting (Upsert Mappings)
   ========================================== */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bankId, singleEntryFlag, mappings } = body;

    if (!bankId || !Array.isArray(mappings)) {
      return NextResponse.json(
        { success: false, message: "bankId and mappings array are required." },
        { status: 400 }
      );
    }

    const numericBankId = Number(bankId);

    // 1. Upsert single entry flag in bank_name_setting table
    const existingNameSetting = await prisma.bank_name_setting.findFirst({
      where: { BANK_ID: numericBankId },
    });

    if (existingNameSetting) {
      await prisma.bank_name_setting.update({
        where: { ID: existingNameSetting.ID },
        data: { SINGLE_ENTRY_FLAG: Boolean(singleEntryFlag) },
      });
    } else {
      await prisma.bank_name_setting.create({
        data: {
          BANK_ID: numericBankId,
          SINGLE_ENTRY_FLAG: Boolean(singleEntryFlag),
        },
      });
    }

    // 2. Soft-delete existing mappings for this bank
    await prisma.bank_csv_settings.updateMany({
      where: { CSV_BANK: numericBankId, IS_DELETED: 0 },
      data: { IS_DELETED: 1 },
    });

    // 3. Batch insert new mapping records
    const createdMappings = [];
    for (const mapping of mappings) {
      const newMapping = await prisma.bank_csv_settings.create({
        data: {
          CSV_BANK: numericBankId,
          CSV_BANK_STATEMENT_NM: String(mapping.csvColumn).trim(),
          DB_BANK_STATEMENT_NM: String(mapping.dbColumn).trim(),
          ANOTHER_DB_BANK_STATEMENT_NM: String(mapping.anotherDbColumn || "").trim(),
          CRDB_FLAG: Boolean(mapping.crdbFlag),
          IS_DELETED: 0,
        },
      });
      createdMappings.push(newMapping);
    }

    return NextResponse.json({
      success: true,
      message: "Bank statement settings saved successfully.",
      data: {
        bankId: numericBankId,
        singleEntryFlag,
        mappings: createdMappings,
      },
    });
  } catch (error) {
    console.error("Failed to save bank statement settings:", error);
    return NextResponse.json(
      { success: false, message: "Failed to save statement settings." },
      { status: 500 }
    );
  }
}
