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
import { getTableDtl, type TableDtlSession } from '@/lib/table-builder/getTableDtl';
import type { DashboardMenuListItem } from '@/lib/dashboard-menu/types';
import { buildListColumns } from '@/lib/dashboard-menu/listColumns';

/**
 * `subject` is whatever getSubjectFromRequest()/assertCanManageDashboardMenu()
 * already resolve for auth — reuse it instead of a second session lookup.
 * TODO: swap the field names below for whatever your `subject` actually
 * carries (role/claims). Mirrors CI's
 * $this->session->userdata('is_admin' | 'oaID' | 'oaBrandID' | 'user_id').
 */

/** menu_config_vw row -> DashboardMenuListItem (matches lib/dashboard-menu/types.ts). */
function toListItem(row: Record<string, any>): DashboardMenuListItem {
  return {
    id: Number(row.ID),
    mstrId: Number(row.MSTR_ID),
    menuName: row.MENU_NM,
    url: row.URL,
    sequence: row.SEQUENCE != null ? Number(row.SEQUENCE) : null,
    showTab: Boolean(Number(row.SHOW_TAB)),
    showMenu: Boolean(Number(row.SHOW_MENU)),
  };
}

/**
 * `subject` is whatever getSubjectFromRequest()/assertCanManageDashboardMenu()
 * already resolve for auth — reuse it instead of a second session lookup.
 * Mirrors CI's $this->session->userdata('is_admin' | 'oaID' | 'oaBrandID' | 'user_id').
 */
function toTableDtlSession(subject: any): TableDtlSession {
  return {
    isAdmin: (subject.isAdmin ?? subject.is_admin ?? 0) as 0 | 1 | 2,
    oaId: subject.oaId ?? subject.orgId ?? null,
    oaBrandId: subject.oaBrandId ?? subject.orgBrandId ?? null,
    userId: subject.userId ?? subject.id ?? null,
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

    const result = await getTableDtl<Record<string, any>>({
      objNm: 'menu_config_vw',
      primaryKeyColumn: 'ID',
      orgColumnName: 'OA_BRAND_ID',
      orgId: session.oaBrandId,
      userColumnName: 'CREATED_BY',
      userId: session.userId,
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