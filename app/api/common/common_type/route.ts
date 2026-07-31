import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ==========================================
   GET : List Common Types
========================================== */
export async function GET() {
  try {
    const commonTypes = await prisma.common_type.findMany({
      orderBy: {
        TYP_ID: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      data: commonTypes,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch Common Types.",
      },
      { status: 500 }
    );
  }
}

/* ==========================================
   POST : Create Common Type
========================================== */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const commonType = await prisma.common_type.create({
      data: {
        TYP_ID: Number(body.type_id),
        TYP_CD: body.type_code,
        TYP_NM: body.type_name,
        VIEW_NM: body.view_name,
        USER_CAN_CREATE_DATA: body.userCanCreateData,
        IS_EDITABLE: body.isEditable,
        ORIGINATING_SYSTEM: "1",
        APP_CD: "GST",
        APP_ID: 1002,
        PARENT_TYP_ID: body.chkParentID
          ? Number(body.parent_id)
          : null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Common Type created successfully.",
        data: commonType,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create Common Type.",
      },
      { status: 500 }
    );
  }
}