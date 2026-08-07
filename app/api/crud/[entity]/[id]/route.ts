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
  {
    params,
  }: {
    params: Promise<{
      entity: string;
      id: string;
    }>;
  }
) {
  try {
    const { entity, id } = await params;

    const service = getService(entity);

    const result = await service.get(id);

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

export async function PUT(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      entity: string;
      id: string;
    }>;
  }
) {
  try {
    const { entity, id } = await params;

    const service = getService(entity);

    const body = await request.json();

    const result = await service.update(id, body);

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

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      entity: string;
      id: string;
    }>;
  }
) {
  try {
    const { entity, id } = await params;

    const service = getService(entity);

    await service.delete(id);

    return NextResponse.json({
      success: true,
      message: "Record deleted successfully.",
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