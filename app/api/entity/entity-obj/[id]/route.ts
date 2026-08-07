import { NextRequest, NextResponse } from "next/server";
import { EntityService } from "@/lib/entity/entityService";

const service = new EntityService();

/**
 * GET /api/entity/:id
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const data = await service.getEntity(Number(id));

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load entity.",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/entity/:id
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const body = await request.json();

    const result = await service.updateEntity(Number(id), body);

    return NextResponse.json({
      success: true,
      data: result,
      message: "Entity updated successfully.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update entity.",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/entity/:id
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await service.deleteEntity(Number(id));

    return NextResponse.json({
      success: true,
      message: "Entity deleted successfully.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to delete entity.",
      },
      { status: 500 }
    );
  }
}