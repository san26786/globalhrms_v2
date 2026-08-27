// app/api/common/import/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ImportService } from "@/lib/import-export/ImportService";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, entity, rows } = body;

    if (!entity) {
      return NextResponse.json(
        { success: false, message: "Missing required parameter: 'entity'." },
        { status: 400 }
      );
    }

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json(
        { success: false, message: "Missing required parameter: 'rows' (must be an array)." },
        { status: 400 }
      );
    }

    if (action === "preview") {
      const preview = await ImportService.generatePreview(entity, rows);
      return NextResponse.json(preview);
    } else if (action === "import") {
      const summary = await ImportService.executeImport(entity, rows);
      return NextResponse.json(summary);
    } else {
      return NextResponse.json(
        { success: false, message: "Invalid action. Supported actions: 'preview', 'import'." },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("Common Import API Error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to process import data." },
      { status: 500 }
    );
  }
}
