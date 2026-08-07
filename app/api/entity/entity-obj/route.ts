import { NextRequest, NextResponse } from "next/server";
import { EntityService } from "@/lib/entity/entityService";

const service = new EntityService();

/**
 * GET /api/entity
 * Equivalent to CodeIgniter index()
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const filters = {
      search: searchParams.get("search") ?? undefined,
      page: Number(searchParams.get("page") ?? 1),
      limit: Number(searchParams.get("limit") ?? 20),
    };

    const data = await service.getEntityList(filters);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load entity list.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/entity
 * Equivalent to save()/add()
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const result = await service.saveEntity(body);

    return NextResponse.json({
      success: true,
      data: result,
      message: "Entity saved successfully.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to save entity.",
      },
      { status: 500 }
    );
  }
}