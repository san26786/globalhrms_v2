// app/api/common/config-mapping/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const mappings = await prisma.config_mapping_dtl.findMany({
      where: { IS_DELETED: 0 },
      orderBy: { CNFG_MPPNG_DTL_ID: "desc" }
    });

    // Map DB fields to friendly names for list view
    const formattedData = mappings.map((item) => ({
      CNFG_MPPNG_ID: item.CNFG_MPPNG_DTL_ID,
      CNFG_CD: item.SRC_ENTITY_CD || item.SRC_ENTTY_CD || "-",
      CNFG_NM: item.TRGT_ENTITY_CD || item.TRGT_ENTTY_CD || "-",
      CNFG_VAL: `Source: ${item.SRC_ENTTY_ID} -> Target: ${item.TRGT_ENTTY_ID}`
    }));

    return NextResponse.json({
      success: true,
      data: formattedData
    });
  } catch (error) {
    console.error("Failed to fetch config mappings:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch config mappings." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const newMapping = await prisma.config_mapping_dtl.create({
      data: {
        SRC_ENTTY_ID: Number(body.src_entity_id || 1),
        TRGT_ENTTY_ID: Number(body.trgt_entity_id || 2),
        SRC_ENTITY_CD: body.cnfg_cd || "",
        TRGT_ENTITY_CD: body.cnfg_nm || "",
        UPDATED_ON: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      data: newMapping
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to create config mapping:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create config mapping." },
      { status: 500 }
    );
  }
}
