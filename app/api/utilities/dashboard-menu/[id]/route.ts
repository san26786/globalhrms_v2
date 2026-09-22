import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getSubjectFromRequest } from '@/lib/auth/getSubject';
import { assertCanManageDashboardMenu, DashboardMenuAccessDeniedError } from '@/lib/dashboard-menu/authorization';
import { dashboardMenuService } from '@/lib/dashboard-menu/dashboardMenuService';
import { IconUploadError } from '@/lib/dashboard-menu/iconUpload';
import { updateDashboardMenuSchema } from '@/validations/dashboardMenu.schema';

interface RouteParams {
  params: { id: string };
}

/* ==========================================
   GET : Load one Dashboard Menu entry (edit form loader)
   CI: Dashboard_menu::editMenu($id) → initForm($id)
========================================== */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const subject = await getSubjectFromRequest(req);
    if (!subject) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    await assertCanManageDashboardMenu(subject);

    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ success: false, message: 'Invalid id' }, { status: 400 });
    }

    const data = await dashboardMenuService.getMenu(id);
    if (!data) {
      return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof DashboardMenuAccessDeniedError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 403 });
    }
    console.error(error);
    return NextResponse.json({ success: false, message: 'Failed to fetch Dashboard Menu entry.' }, { status: 500 });
  }
}

/* ==========================================
   PUT : Update a Dashboard Menu entry
   CI: Dashboard_menu::edit_menu() → setFormControls() → Generateall_m::edit_menu()
========================================== */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const subject = await getSubjectFromRequest(req);
    if (!subject) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    await assertCanManageDashboardMenu(subject);

    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ success: false, message: 'Invalid id' }, { status: 400 });
    }

    const form = await req.formData();
    const input = updateDashboardMenuSchema.parse({
      menuName: form.get('menuName'),
      menuUrl: form.get('menuUrl'),
      sequence: form.get('sequence'),
    });

    await dashboardMenuService.updateMenu(id, input, {
      small: form.get('smallIcon') as File | null,
      medium: form.get('mediumIcon') as File | null,
      block: form.get('blockIcon') as File | null,
    });

    return NextResponse.json({ success: true, message: 'Successfully update record' });
  } catch (error) {
    if (error instanceof DashboardMenuAccessDeniedError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 403 });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ success: false, message: 'Validation failed', errors: error.flatten() }, { status: 400 });
    }
    if (error instanceof IconUploadError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ success: false, message: 'Failed to update Dashboard Menu entry.' }, { status: 500 });
  }
}
