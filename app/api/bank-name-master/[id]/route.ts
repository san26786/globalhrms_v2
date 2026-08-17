import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const params = await paramsPromise;
    const mstrId = parseInt(params.id);

    if (isNaN(mstrId)) {
      return NextResponse.json(
        { success: false, message: "Invalid Bank Master ID." },
        { status: 400 }
      );
    }

    const record = await prisma.independent_mst.findUnique({
      where: { MSTR_ID: mstrId }
    });

    if (!record || record.IS_DELETED) {
      return NextResponse.json(
        { success: false, message: "Bank Name Master record not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    console.error("Fetch bank name detail failed:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch bank name details." },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const params = await paramsPromise;
    const mstrId = parseInt(params.id);

    if (isNaN(mstrId)) {
      return NextResponse.json(
        { success: false, message: "Invalid Bank Master ID." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { code, name, description } = body;

    if (!code || !name) {
      return NextResponse.json(
        { success: false, message: "Bank Code and Bank Name are required." },
        { status: 400 }
      );
    }

    const record = await prisma.independent_mst.findUnique({
      where: { MSTR_ID: mstrId }
    });

    if (!record || record.IS_DELETED) {
      return NextResponse.json(
        { success: false, message: "Bank Name Master record not found." },
        { status: 404 }
      );
    }

    // Check code unique (exclude current ID)
    const existingCode = await prisma.independent_mst.findFirst({
      where: {
        TYP_ID: record.TYP_ID,
        MSTR_CD: {
          equals: code,
          mode: "insensitive"
        },
        MSTR_ID: {
          not: mstrId
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

    // Check name unique (exclude current ID)
    const existingName = await prisma.independent_mst.findFirst({
      where: {
        TYP_ID: record.TYP_ID,
        MSTR_NM: {
          equals: name,
          mode: "insensitive"
        },
        MSTR_ID: {
          not: mstrId
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

    const updated = await prisma.independent_mst.update({
      where: { MSTR_ID: mstrId },
      data: {
        MSTR_CD: code,
        MSTR_NM: name,
        MSTR_DESC: description || ""
      }
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update bank name failed:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update bank name master record." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const params = await paramsPromise;
    const mstrId = parseInt(params.id);

    if (isNaN(mstrId)) {
      return NextResponse.json(
        { success: false, message: "Invalid Bank Master ID." },
        { status: 400 }
      );
    }

    const record = await prisma.independent_mst.findUnique({
      where: { MSTR_ID: mstrId }
    });

    if (!record || record.IS_DELETED) {
      return NextResponse.json(
        { success: false, message: "Bank Name Master record not found." },
        { status: 404 }
      );
    }

    // Soft delete
    await prisma.independent_mst.update({
      where: { MSTR_ID: mstrId },
      data: {
        IS_DELETED: true
      }
    });

    return NextResponse.json({ success: true, message: "Bank Name Master record deleted successfully." });
  } catch (error) {
    console.error("Delete bank name failed:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete bank name master record." },
      { status: 500 }
    );
  }
}
