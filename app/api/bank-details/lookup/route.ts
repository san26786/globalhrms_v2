import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_BANKS = [
  { code: "BNICICI", name: "ICICI Bank", desc: "" },
  { code: "BNHSBC", name: "HSBC", desc: "" },
  { code: "BNHDFC", name: "HDFC", desc: "" },
  { code: "BNDB", name: "Dena Bank", desc: "" },
  { code: "BNBOI", name: "Bank Of India", desc: "" },
  { code: "BNBC", name: "Bassien Catholic Bank", desc: "Bank Name testing" },
  { code: "BNBARCL", name: "Barclays", desc: "" },
  { code: "BNAXISB", name: "Axis Bank", desc: "" },
  { code: "BNBOB", name: "Bank Of Baroda", desc: "" },
  { code: "78", name: "SWASWAT BANK", desc: "pvt Ltd" },
  { code: "BNUBI", name: "Union Bank Of India", desc: "" },
  { code: "BNTSB", name: "TSB", desc: "" },
  { code: "BNSBI", name: "State Bank of india", desc: "" },
  { code: "BNSANT", name: "Santandar", desc: "" },
  { code: "BNRBI", name: "RBI", desc: "" },
  { code: "BNPNB", name: "Punjab National Bank", desc: "" },
  { code: "BNPMC", name: "Punjab Maharashtra Bank", desc: "" },
  { code: "BNNW", name: "Natwest", desc: "" },
  { code: "BNMB", name: "Mumbai Bank", desc: "" },
  { code: "BNLLOYDS", name: "Lloyds Bank", desc: "" },
  { code: "45", name: "BOI", desc: "fhjksaj" }
];

export async function GET() {
  try {
    // 1. Fetch Bank Names Type (SEBN)
    const sebnType = await prisma.common_type.findFirst({
      where: { TYP_CD: "SEBN" },
    });

    const bankOptions = [];

    if (sebnType) {
      // Seed/resolve banks against the database keys in independent_mst
      for (const bank of DEFAULT_BANKS) {
        let existingBank = await prisma.independent_mst.findFirst({
          where: {
            TYP_ID: sebnType.TYP_ID,
            MSTR_NM: {
              equals: bank.name,
              mode: "insensitive",
            },
          },
        });

        if (existingBank) {
          // Sync code and description if missing/different
          if (existingBank.MSTR_CD !== bank.code || existingBank.MSTR_DESC !== bank.desc) {
            existingBank = await prisma.independent_mst.update({
              where: { MSTR_ID: existingBank.MSTR_ID },
              data: {
                MSTR_CD: bank.code,
                MSTR_DESC: bank.desc
              }
            });
          }
        } else {
          // Create the missing bank master record
          existingBank = await prisma.independent_mst.create({
            data: {
              MSTR_CD: bank.code,
              MSTR_NM: bank.name,
              MSTR_DESC: bank.desc,
              TYP_ID: sebnType.TYP_ID,
              IS_DEFAULT_FOR_SYNC: false,
              SEQUENCE: 0,
              IS_ACTIVE: 1,
              IS_ENABLED: 1,
              IS_DELETED: false,
            },
          });
        }

        bankOptions.push({
          label: existingBank.MSTR_NM,
          value: String(existingBank.MSTR_ID),
        });
      }
    } else {
      DEFAULT_BANKS.forEach((bank, index) => {
        bankOptions.push({
          label: bank.name,
          value: String(index + 1),
        });
      });
    }

    // Sort bank options alphabetically
    bankOptions.sort((a, b) => a.label.localeCompare(b.label));

    // 2. Fetch Account Types (Type Code: CTBAT)
    const ctbatType = await prisma.common_type.findFirst({
      where: { TYP_CD: "CTBAT" },
    });
    
    const accountTypes = ctbatType
      ? await prisma.independent_mst.findMany({
          where: {
            TYP_ID: ctbatType.TYP_ID,
            OR: [
              { IS_DELETED: false },
              { IS_DELETED: null }
            ]
          },
          select: { MSTR_ID: true, MSTR_NM: true },
          orderBy: { MSTR_NM: "asc" },
        })
      : [];

    const finalAccountTypes = accountTypes.length > 0
      ? accountTypes.map((a: any) => ({ label: a.MSTR_NM, value: String(a.MSTR_ID) }))
      : [
          { label: "Savings Account", value: "1" },
          { label: "Current Account", value: "2" },
          { label: "Salary Account", value: "3" }
        ];

    return NextResponse.json({
      success: true,
      bankNames: bankOptions,
      accountTypes: finalAccountTypes,
    });
  } catch (error) {
    console.error("Lookup API failed:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch lookup data." },
      { status: 500 }
    );
  }
}
