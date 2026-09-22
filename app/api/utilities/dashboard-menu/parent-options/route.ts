import { NextRequest, NextResponse } from 'next/server';
import { getSubjectFromRequest } from '@/lib/auth/getSubject';
import { assertCanManageDashboardMenu, DashboardMenuAccessDeniedError } from '@/lib/dashboard-menu/authorization';
import { dashboardMenuService } from '@/lib/dashboard-menu/dashboardMenuService';

/* ==========================================
   GET : "Parent Module" dropdown options
   CI: Dashboard_menu::initForm() → getChildMenu(PARENT_MENU_ID)
========================================== */
export async function GET(req: NextRequest) {
  try {
    const subject = await getSubjectFromRequest(req);
    if (!subject) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    await assertCanManageDashboardMenu(subject);

    const data = await dashboardMenuService.getParentModuleOptions(subject);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof DashboardMenuAccessDeniedError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 403 });
    }
    console.error(error);
    return NextResponse.json({ success: false, message: 'Failed to fetch parent module options.' }, { status: 500 });
  }
}
