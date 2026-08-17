import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
    const sebnType = await prisma.common_type.findFirst({
      where: { TYP_CD: "SEBN" },
    });

    if (!sebnType) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Upsert default banks to ensure database is in sync with screenshot data
    for (const bank of DEFAULT_BANKS) {
      const existing = await prisma.independent_mst.findFirst({
        where: {
          TYP_ID: sebnType.TYP_ID,
          MSTR_NM: {
            equals: bank.name,
            mode: "insensitive"
          }
        }
      });

      if (existing) {
        // Update if code or description is missing or different
        if (existing.MSTR_CD !== bank.code || existing.MSTR_DESC !== bank.desc) {
          await prisma.independent_mst.update({
            where: { MSTR_ID: existing.MSTR_ID },
            data: {
              MSTR_CD: bank.code,
              MSTR_DESC: bank.desc
            }
          });
        }
      } else {
        // Create new
        await prisma.independent_mst.create({
          data: {
            MSTR_CD: bank.code,
            MSTR_NM: bank.name,
            MSTR_DESC: bank.desc,
            TYP_ID: sebnType.TYP_ID,
            IS_DEFAULT_FOR_SYNC: false,
            SEQUENCE: 0,
            IS_ACTIVE: 1,
            IS_ENABLED: 1,
            IS_DELETED: false
          }
        });
      }
    }

    const list = await prisma.independent_mst.findMany({
      where: {
        TYP_ID: sebnType.TYP_ID,
        OR: [
          { IS_DELETED: false },
          { IS_DELETED: null }
        ]
      },
      orderBy: { MSTR_NM: "asc" }
    });

    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    console.error("Fetch bank names failed:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch bank names list." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, name, description } = body;

    if (!code || !name) {
      return NextResponse.json(
        { success: false, message: "Bank Code and Bank Name are required." },
        { status: 400 }
      );
    }

    const sebnType = await prisma.common_type.findFirst({
      where: { TYP_CD: "SEBN" },
    });

    if (!sebnType) {
      return NextResponse.json(
        { success: false, message: "Common Type 'SEBN' is not configured in the system." },
        { status: 500 }
      );
    }

    // Check unique code
    const existingCode = await prisma.independent_mst.findFirst({
      where: {
        TYP_ID: sebnType.TYP_ID,
        MSTR_CD: {
          equals: code,
          mode: "insensitive"
        },
        OR: [
          { IS_DELETED: false },
          { IS_DELETED: null }
        ]
      }
    });

    if (existingCode) {
      return NextResponse.json(
        { success: false, message: "Bank Code already exists." },
        { status: 400 }
      );
    }

    // Check unique name
    const existingName = await prisma.independent_mst.findFirst({
      where: {
        TYP_ID: sebnType.TYP_ID,
        MSTR_NM: {
          equals: name,
          mode: "insensitive"
        },
        OR: [
          { IS_DELETED: false },
          { IS_DELETED: null }
        ]
      }
    });

    if (existingName) {
      return NextResponse.json(
        { success: false, message: "Bank Name already exists." },
        { status: 400 }
      );
    }

    const newRecord = await prisma.independent_mst.create({
      data: {
        MSTR_CD: code,
        MSTR_NM: name,
        MSTR_DESC: description || "",
        TYP_ID: sebnType.TYP_ID,
        IS_DEFAULT_FOR_SYNC: false,
        SEQUENCE: 0,
        IS_ACTIVE: 1,
        IS_ENABLED: 1,
        IS_DELETED: false
      }
    });

    return NextResponse.json({ success: true, data: newRecord });
  } catch (error) {
    console.error("Create bank name master failed:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create bank name master record." },
      { status: 500 }
    );
  }
}
