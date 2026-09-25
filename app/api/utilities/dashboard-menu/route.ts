// import { NextRequest, NextResponse } from 'next/server';
// import { ZodError } from 'zod';
// import { getSubjectFromRequest } from '@/lib/auth/getSubject';
// import { assertCanManageDashboardMenu, DashboardMenuAccessDeniedError } from '@/lib/dashboard-menu/authorization';
// import { dashboardMenuService } from '@/lib/dashboard-menu/dashboardMenuService';
// import { IconUploadError } from '@/lib/dashboard-menu/iconUpload';
// import { createDashboardMenuSchema } from '@/validations/dashboardMenu.schema';

// /* ==========================================
//    GET : List Dashboard Menu entries
//    CI: Dashboard_menu::index()
// ========================================== */
// export async function GET(req: NextRequest) {
//   try {
//     const subject = await getSubjectFromRequest(req);
//     if (!subject) {
//       return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
//     }
//     await assertCanManageDashboardMenu(subject);

//     const data = await dashboardMenuService.listMenus();
//     return NextResponse.json({ success: true, data });
//   } catch (error) {
//     if (error instanceof DashboardMenuAccessDeniedError) {
//       return NextResponse.json({ success: false, message: error.message }, { status: 403 });
//     }
//     console.error(error);
//     return NextResponse.json({ success: false, message: 'Failed to fetch Dashboard Menu entries.' }, { status: 500 });
//   }
// }

// /* ==========================================
//    POST : Create a Dashboard Menu entry
//    CI: Dashboard_menu::create_menu() → setFormControls() → Generateall_m::create_menu()
//    multipart/form-data — CI's form used enctype=multipart/form-data for the 3 icon uploads.
// ========================================== */
// export async function POST(req: NextRequest) {
//   try {
//     const subject = await getSubjectFromRequest(req);
//     if (!subject) {
//       return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
//     }
//     await assertCanManageDashboardMenu(subject);

//     const form = await req.formData();

//     const input = createDashboardMenuSchema.parse({
//       parentModuleId: form.get('parentModuleId') || null,
//       menuCode: form.get('menuCode'),
//       menuName: form.get('menuName'),
//       menuUrl: form.get('menuUrl'),
//       sequence: form.get('sequence'),
//     });

//     const { id } = await dashboardMenuService.createMenu(input, {
//       small: form.get('smallIcon') as File | null,
//       medium: form.get('mediumIcon') as File | null,
//       block: form.get('blockIcon') as File | null,
//     });

//     return NextResponse.json(
//       { success: true, message: 'Successfully Added', data: { id } },
//       { status: 201 },
//     );
//   } catch (error) {
//     if (error instanceof DashboardMenuAccessDeniedError) {
//       return NextResponse.json({ success: false, message: error.message }, { status: 403 });
//     }
//     if (error instanceof ZodError) {
//       return NextResponse.json({ success: false, message: 'Validation failed', errors: error.flatten() }, { status: 400 });
//     }
//     if (error instanceof IconUploadError) {
//       return NextResponse.json({ success: false, message: error.message }, { status: 400 });
//     }
//     console.error(error);
//     return NextResponse.json({ success: false, message: 'Failed to create Dashboard Menu entry.' }, { status: 500 });
//   }
// }


//--------------------------------------//
import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getSubjectFromRequest } from '@/lib/auth/getSubject';
import { assertCanManageDashboardMenu, DashboardMenuAccessDeniedError } from '@/lib/dashboard-menu/authorization';
import { dashboardMenuService } from '@/lib/dashboard-menu/dashboardMenuService';
import { IconUploadError } from '@/lib/dashboard-menu/iconUpload';
import { createDashboardMenuSchema } from '@/validations/dashboardMenu.schema';
import { getTableDtl, toTableDtlSession } from '@/lib/table-builder/getTableDtl';
import type { DashboardMenuListItem } from '@/lib/dashboard-menu/types';
import { buildListColumns } from '@/lib/dashboard-menu/listColumns';

/**
 * Raw menu_config_vw row. Only the visible-for-listview columns are selected,
 * so every field may be absent. Note the view's column is lowercase
 * `sequence` (inherited from menu_config), not `SEQUENCE`.
 */
interface MenuConfigVwRow {
  ID?: number;
  MSTR_ID?: number | null;
  MENU_NM?: string | null;
  URL?: string;
  sequence?: number | null;
  SHOW_TAB?: number;
  SHOW_MENU?: number;
}

/** menu_config_vw row -> DashboardMenuListItem (matches lib/dashboard-menu/types.ts). */
function toListItem(row: MenuConfigVwRow): DashboardMenuListItem {
  return {
    id: Number(row.ID),
    mstrId: Number(row.MSTR_ID ?? 0),
    menuName: row.MENU_NM ?? '',
    url: row.URL ?? '',
    sequence: row.sequence != null ? Number(row.sequence) : null,
    showTab: Number(row.SHOW_TAB) === 1,
    showMenu: Number(row.SHOW_MENU) === 1,
  };
}

/* ==========================================
   GET : List Dashboard Menu entries
   CI: Dashboard_menu::index() — was common_c::getTableDtl() against
   menu_config_vw. Now backed by the generic getTableDtl() port instead of
   dashboardMenuService.listMenus(), same objNm as the legacy controller.
========================================== */
export async function GET(req: NextRequest) {
  try {
    const subject = await getSubjectFromRequest(req);
    if (!subject) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    await assertCanManageDashboardMenu(subject);

    const session = toTableDtlSession(subject);
    const { searchParams } = new URL(req.url);

    // No org/user scoping columns: menu_config_vw is system-wide menu
    // configuration and has no OA_BRAND_ID / CREATED_BY columns to filter on.
    const result = await getTableDtl<MenuConfigVwRow>({
      objNm: 'menu_config_vw',
      primaryKeyColumn: 'ID',
      session,
      page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
    });

    const data: DashboardMenuListItem[] = result.tableBody.map(toListItem);
    const columns = buildListColumns(result);          // ← new

    return NextResponse.json({ success: true, data, total: result.total, columns });
  } catch (error) {
    if (error instanceof DashboardMenuAccessDeniedError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 403 });
    }
    console.error(error);
    return NextResponse.json({ success: false, message: 'Failed to fetch Dashboard Menu entries.' }, { status: 500 });
  }
}

/* ==========================================
   POST : Create a Dashboard Menu entry
   CI: Dashboard_menu::create_menu() → setFormControls() → Generateall_m::create_menu()
   multipart/form-data — CI's form used enctype=multipart/form-data for the 3 icon uploads.
   Unchanged — getTableDtl() is a read-side (list-view) helper only, it has
   no bearing on the create/write path.
========================================== */
export async function POST(req: NextRequest) {
  try {
    const subject = await getSubjectFromRequest(req);
    if (!subject) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    await assertCanManageDashboardMenu(subject);

    const form = await req.formData();

    const input = createDashboardMenuSchema.parse({
      parentModuleId: form.get('parentModuleId') || null,
      menuCode: form.get('menuCode'),
      menuName: form.get('menuName'),
      menuUrl: form.get('menuUrl'),
      sequence: form.get('sequence'),
    });

    const { id } = await dashboardMenuService.createMenu(input, {
      small: form.get('smallIcon') as File | null,
      medium: form.get('mediumIcon') as File | null,
      block: form.get('blockIcon') as File | null,
    });

    return NextResponse.json(
      { success: true, message: 'Successfully Added', data: { id } },
      { status: 201 },
    );
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
    return NextResponse.json({ success: false, message: 'Failed to create Dashboard Menu entry.' }, { status: 500 });
  }
}