import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const empId = Number(id);

    if (isNaN(empId)) {
      return NextResponse.json(
        { success: false, message: "Invalid Employee ID" },
        { status: 400 }
      );
    }

    // Soft delete by setting IS_DELETED = 1
    await prisma.emp_mst.update({
      where: { EMP_ID: empId },
      data: { IS_DELETED: 1 },
    });

    return NextResponse.json({
      success: true,
      message: "Employee soft-deleted successfully.",
    });
  } catch (error) {
    console.error("Failed to delete employee:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete employee." },
      { status: 500 }
    );
  }
}
