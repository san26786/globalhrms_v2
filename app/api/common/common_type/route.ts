import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const commonTypes = await prisma.common_type.findMany({
        orderBy: {
          TYP_ID: "desc",
        },
      });

    return NextResponse.json({
      status: "success",
      data: commonTypes
    });
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { status: "error", message: "Something went wrong!" },
      { status: 500 }
    );
  }
}