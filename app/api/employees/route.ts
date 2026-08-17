import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";

    const employees = await prisma.emp_mst.findMany({
      where: {
        IS_DELETED: 0,
        OR: [
          { EMP_NAME: { contains: search, mode: "insensitive" } },
          { EMPLST_NM: { contains: search, mode: "insensitive" } },
          { EMP_NBR: { contains: search, mode: "insensitive" } },
        ],
      },
      select: {
        EMP_ID: true,
        EMP_NBR: true,
        EMP_NAME: true,
        EMPLST_NM: true,
      },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      data: employees,
    });
  } catch (error) {
    console.error("Failed to fetch employees:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch employees." },
      { status: 500 }
    );
  }
}
