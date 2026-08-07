import { NextRequest, NextResponse } from "next/server";

import { CrudService } from "@/lib/crud";
import { CRUD_REGISTRY } from "@/lib/crud/crudRegistry";

function getService(entity: string) {
  const config = CRUD_REGISTRY[entity];

  if (!config) {
    throw new Error(`Unknown entity: ${entity}`);
  }

  return new CrudService(config);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  try {
    const { entity } = await params;

    const service = getService(entity);

    const searchParams = request.nextUrl.searchParams;

    const result = await service.getAll({
      page: Number(searchParams.get("page") ?? 1),
      limit: Number(searchParams.get("limit") ?? 20),
      search: searchParams.get("search") ?? undefined,
      sortBy: searchParams.get("sortBy") ?? undefined,
      sortOrder:
        (searchParams.get("sortOrder") as "asc" | "desc") ?? "asc",
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  try {
    const { entity } = await params;

    const service = getService(entity);

    const body = await request.json();

    const result = await service.create(body);

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}