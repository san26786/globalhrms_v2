import type { AccessPolicy } from '@/lib/resource/types';
import { menuPolicy } from '@/lib/resource/policies';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { periodListScope } from '@/lib/periodMngt';
import { companyDocumentsService } from '@/lib/systmMngt/companyDocuments';
import { oaBrandSettingsService } from '@/lib/systmMngt/oaBrandSettings';
import { orgAccountsService } from '@/lib/systmMngt/orgAccounts';
import { oaBrandsService } from '@/lib/systmMngt/oaBrands';
import { employeePaymentsService } from '@/lib/systmMngt/employeePayments';

/** Static filters decided per request: column = value pairs and/or one "column IN (…)". */
export interface ListScope {
  equals?: Array<{ column: string; value: string | number }>;
  in?: { column: string; values: Array<string | number> };
}

/**
 * Generic list screens — one entry per CI controller index(), holding exactly the arguments that
 * controller passed to common_c::getTableDtl() plus its $listActions / $actions / $deleteAll.
 * NO columns here: which columns are listed, their labels and their order come from the entity
 * configuration (entity_obj_attrbt / entity_obj_attrbt_dsply_dtl) at request time, as in CI.
 *
 * A list works as soon as its objNm exists in PostgreSQL. The CI MySQL views (*_vw) were not
 * migrated; recreate a view, add its entry here, and the page is just
 * `<EntityListView list="key" />`.
 */
export interface ListDefinition {
  /** CI $head['title']. */
  title: string;
  /** CI $common->getTitleByCode('PCMN'): code whose title is read from the database. */
  titleCode?: string;
  /** CI $pvs_ObjNm — table or view listed (also the Form Settings object). */
  objNm: string;
  /** CI $primaryKeyColumn. */
  primaryKey: string;
  /** CI menu URL: its permission_dtl FUNCTION grant decides list / add / edit / delete. */
  policy: AccessPolicy;
  /** CI $colNm / $colValue static filter. */
  where?: { column: string; value: string | number };
  /** CI $orgColumName (+ $orgID = session brand), applied to brand admins. */
  orgColumn?: string;
  /** What CI passed as $orgID: the session brand (default) or the session organisation (oaID). */
  orgScope?: 'brand' | 'org';
  /** CI $userColumnName (+ $userID = session user), applied to normal users. */
  userColumn?: string;
  /** What CI passed as $userID: the session user (default) or the session brand (oaBrandID). */
  userScope?: 'user' | 'brand';
  /**
   * CI index($arg…) → $colNm / $colValue decided per request (e.g. period_mst's period type /
   * status filters). Receives the page's query parameters; replaces `where`.
   */
  scope?: (subject: RequestSubject, query: Record<string, string>) => Promise<ListScope>;
  /** Columns returned with each row although not listed (CI row-action conditions). */
  extraColumns?: string[];
  /** CI $listActions "Sync": POST endpoint. Shown to brand admins (level 1) only, like CI is_admin == 1. */
  syncApi?: string;
  /** CI $listActions "Add New …": the Next add page. */
  addHref?: string;
  /** CI $actions['edit']: the Next edit page; `/{primary key}` is appended. */
  editHref?: string;
  /** CI $actions['delete'] / Delete Selected: the API item route; DELETE `${deleteApi}/{id}`. */
  deleteApi?: string;
  /** CI $deleteAll (default true when deleteApi is set). */
  deleteAll?: boolean;
  /** CI $actions['delete'] per row (default true when deleteApi is set); false = Delete Selected only. */
  rowDelete?: boolean;
}

export const LIST_DEFINITIONS = {
  /** CI utilities/dashboard_menu::index() */
  dashboard_menu: {
    title: 'Create Menu',
    objNm: 'menu_config_vw',
    primaryKey: 'ID',
    policy: menuPolicy('utilities/dashboard_menu'),
    addHref: '/utilities/dashboard-menu/add',
    editHref: '/utilities/dashboard-menu/edit',
    deleteAll: false, // CI: $data['deleteAll'] = false; no delete action
  },
  /** CI user/permission_class::index() */
  permission_class: {
    title: 'Permission Class',
    titleCode: 'PCMN',                     // CI $common->getTitleByCode('PCMN')
    objNm: 'permission_class_mst_vw',      // CI $pvs_ObjNm
    primaryKey: 'MSTR_ID',                 // CI $primaryKeyColumn (= PERMISSIONS_CLASS_ID in this view)
    policy: menuPolicy('user/permission_class'),
    addHref: '/user/permission_class/add', // CI user/permission_dtl/newPermissionDtl
    editHref: '/user/permission_class/edit', // CI user/permission_dtl/editPermissionDtl/{PERMISSIONS_CLASS_ID}
    deleteApi: '/api/user/permission_class', // CI user/permission_class/delete/{id}
    syncApi: '/api/user/permission_class/sync', // CI sync_permissions (is_admin == 1)
    deleteAll: true,                       // CI sets no $deleteAll = false
    orgColumn: 'OABRANDID',                // CI $orgColumName (= session oaBrandID)
    userColumn: 'USERID',                  // CI $userColumnName (= session user_id)
  },
  /** CI user/permission_dtl::index() — every permission_dtl row of the organisation. */
  permission_dtl: {
    title: 'Permission Details',            // CI $head['title']
    objNm: 'permission_dtl_vw',             // CI $pvs_ObjNm (view: prisma/sql/views/permission_dtl_vw.sql)
    primaryKey: 'PERMISSIONS_DTL_ID',       // CI $primaryKeyColumn
    policy: menuPolicy('user/permission_dtl'),
    addHref: '/user/permission_dtl/add',    // CI newPermissionDtl (the same form as Permission Class)
    deleteApi: '/api/user/permission_dtl',  // CI Delete Selected → common_c::softDelete
    rowDelete: false,                       // CI deleteFunctionName = '' (no row edit / delete)
    orgColumn: 'ORG_ACC_ID',                // CI $orgColumName
    orgScope: 'org',                        // CI $orgID = session oaID
    userColumn: 'USERID',                   // CI $userColumnName
  },
  /** CI periodMngt/period_mst::index($periodTypeId, $periodStatusId) */
  period_mst: {
    title: 'Period Master',
    titleCode: 'PMSMN',                     // CI $common->getTitleByCode('PMSMN')
    objNm: 'period_mst_vw',                 // CI $pvs_ObjNm (view: prisma/sql/views/period_mst_vw.sql)
    primaryKey: 'PERIOD_ID',
    policy: menuPolicy('periodMngt/period_mst'),
    addHref: '/periodMngt/period_mst/add',   // CI periodMngt/period_mst/addPeriod
    editHref: '/periodMngt/period_mst/edit', // CI periodMngt/period_mst/editPeriod/{PERIOD_ID}
    deleteApi: '/api/periodMngt/period_mst', // CI periodMngt/period_mst/delete/{PERIOD_ID}
    orgColumn: 'OABRANDID',                 // CI $orgColumName (= session oaBrandID)
    userColumn: 'OABRANDID',                // CI $userColumnName …
    userScope: 'brand',                     // … with $userID = session oaBrandID (users see the brand's periods)
    scope: periodListScope,                 // CI type / status / enabled-types $colNm
    extraColumns: ['IS_VERIFIED'],          // CI $actions['verify']['cond'] = IS_VERIFIED 'No'
  },
  /** CI systmMngt/salary_component_settings::index() ("Salary Component") */
  salary_component_settings: {
    title: 'Salary Component',
    objNm: 'salary_component_settings_vw',  // view: prisma/sql/views/salary_component_settings_vw.sql
    primaryKey: 'SC_ID',
    policy: menuPolicy('systmMngt/salary_component_settings'),
    addHref: '/systmMngt/salary_component_settings/add',
    editHref: '/systmMngt/salary_component_settings/edit',
    syncApi: '/api/systmMngt/salary_component_settings/sync',
    deleteApi: '/api/systmMngt/salary_component_settings',
    orgColumn: 'OABRANDID',
    userColumn: 'USERID',
  },
  /** CI salaryComponentMember/salarycomponentmember::index() ("Component Member") */
  salary_component_member: {
    title: 'Component Member',
    objNm: 'salarycomponentmember_vw',      // view: prisma/sql/views/salarycomponentmember_vw.sql
    primaryKey: 'SALARY_COMP_MEMBER_ID',
    policy: menuPolicy('salaryComponentMember/salarycomponentmember'),
    addHref: '/salaryComponentMember/salarycomponentmember/add',
    editHref: '/salaryComponentMember/salarycomponentmember/edit',
    syncApi: '/api/salaryComponentMember/salarycomponentmember/sync',
    deleteApi: '/api/salaryComponentMember/salarycomponentmember',
    orgColumn: 'OABRANDID',
    userColumn: 'USERID',
  },
  /** CI systmMngt/company_documents::index() — member_attachment rows of entity type CDT */
  company_documents: {
    title: 'Company Documents',
    objNm: 'company_documents_vw',          // view: prisma/sql/views/company_documents_vw.sql
    primaryKey: 'ID',
    policy: menuPolicy('systmMngt/company_documents'),
    addHref: '/systmMngt/company_documents/add',   // CI user/member_file_upload/newFileUpload/{brand}/BRAND_ID
    editHref: '/systmMngt/company_documents/edit', // CI user/member_file_upload/editFileUpload/{id}/{brand}/BRAND_ID
    deleteApi: '/api/systmMngt/company_documents',
    orgColumn: 'OA_BRAND_ID',
    userColumn: 'USER_ID',
    scope: () => companyDocumentsService.listScope(), // CI colNm LINKED_SYSTEM_ENTITY_TYPE_ID = CDT
  },
  /**
   * CI systmMngt/oa_brand_settings::index($brandId, $type): "Company Settings" (COMPANY_ATTRIBUTE 0) or,
   * with ?type=ATTR, the oa_brands tab "Company Attributes" (1). Add is a page action (it carries the
   * brand and kind); edit / delete per row.
   */
  oa_brand_settings: {
    title: 'Company Settings',
    objNm: 'oa_brand_settings_vw',          // view: prisma/sql/views/oa_brand_settings_vw.sql
    primaryKey: 'OAB_SETTING_ID',
    policy: menuPolicy('systmMngt/oa_brands'),
    editHref: '/systmMngt/oa_brand_settings/edit',
    deleteApi: '/api/systmMngt/oa_brand_settings',
    scope: (subject, query) => oaBrandSettingsService.listScope(subject, query), // brand (checked) + kind
  },
  /**
   * CI systmMngt/org_accounts::index() ("Organisation"; no menu entry — the header links here, so the
   * policy falls back to admins). Rows: superadmin all, admin their organisation (lib/systmMngt/orgAccounts).
   */
  org_accounts: {
    title: 'Organisation',
    objNm: 'org_accounts_vw',               // view: prisma/sql/views/org_accounts_vw.sql
    primaryKey: 'OA_ID',
    policy: menuPolicy('systmMngt/org_accounts'),
    editHref: '/systmMngt/org_accounts/edit',
    deleteApi: '/api/systmMngt/org_accounts',
    scope: (subject) => orgAccountsService.listScope(subject),
  },
  /** CI systmMngt/oa_brands::index() ("Oa Brands"; menu "Oa Brands  Epic"). Rows: see lib/systmMngt/oaBrands. */
  oa_brands: {
    title: 'Oa Brands',
    titleCode: 'FMIOB',                     // CI $common->getTitleByCode('FMIOB')
    objNm: 'oa_brands_vw',                  // view: prisma/sql/views/oa_brands_vw.sql
    primaryKey: 'OA_BRAND_ID',
    policy: menuPolicy('systmMngt/oa_brands'),
    editHref: '/systmMngt/oa_brands/edit',
    deleteApi: '/api/systmMngt/oa_brands',
    deleteAll: false,                       // CI $data['deleteAll'] = false
    scope: (subject) => oaBrandsService.listScope(subject),
  },
  /** CI systmMngt/employee_payment_details::index($empId) ("Payroll Processing"; no menu entry). */
  employee_payment_details: {
    title: 'Employee Payment Details',
    objNm: 'employee_payment_details_vw',   // view: prisma/sql/views/employee_payment_details_views.sql
    primaryKey: 'EP_ID',
    policy: menuPolicy('systmMngt/employee_payment_details'),
    editHref: '/systmMngt/employee_payment_details/edit',
    deleteApi: '/api/systmMngt/employee_payment_details',
    scope: (subject, query) => employeePaymentsService.listScope(subject, query), // brand / own rows / ?empId
  },
  /** CI systmMngt/emp_monthly_payment_details::index() ("Emp Monthly Salary") — read-only totals. */
  emp_monthly_payment_details: {
    title: 'Employee Monthly Payment Details',
    objNm: 'employee_payment_details_monthly_vw',
    primaryKey: 'EMP_ID',
    policy: menuPolicy('systmMngt/emp_monthly_payment_details'),
    orgColumn: 'OA_BRAND_ID',
    userColumn: 'USER_ID',
    deleteAll: false,
  },
  /** CI systmMngt/emp_yearly_payment_details::index() ("Emp Yearly Salary") — read-only totals. */
  emp_yearly_payment_details: {
    title: 'Employee Annual Payment Details',
    objNm: 'employee_payment_details_yearly_vw',
    primaryKey: 'EMP_ID',
    policy: menuPolicy('systmMngt/emp_yearly_payment_details'),
    orgColumn: 'OA_BRAND_ID',
    userColumn: 'USER_ID',
    deleteAll: false,
  },
  /** CI systmMngt/document_template::index() */
  document_template: {
    title: 'Document Template',
    objNm: 'document_template_vw',          // view: prisma/sql/views/document_template_vw.sql
    primaryKey: 'ID',
    policy: menuPolicy('systmMngt/document_template'),
    addHref: '/systmMngt/document_template/add',
    editHref: '/systmMngt/document_template/edit',
    deleteApi: '/api/systmMngt/document_template',
    orgColumn: 'OA_BRAND_ID',
    userColumn: 'USER_ID',
  },
  /** CI systmMngt/document_templates_variables::index() */
  document_templates_variables: {
    title: 'Document Template Variables',
    objNm: 'document_templates_variables_vw', // view: prisma/sql/views/document_templates_variables_vw.sql
    primaryKey: 'ID',
    policy: menuPolicy('systmMngt/document_templates_variables'),
    addHref: '/systmMngt/document_templates_variables/add',
    editHref: '/systmMngt/document_templates_variables/edit',
    deleteApi: '/api/systmMngt/document_templates_variables',
    orgColumn: 'OA_BRAND_ID',
    userColumn: 'USER_ID',
  },
} satisfies Record<string, ListDefinition>;

export type ListKey = keyof typeof LIST_DEFINITIONS;

export function getListDefinition(key: string): ListDefinition | null {
  return Object.prototype.hasOwnProperty.call(LIST_DEFINITIONS, key)
    ? (LIST_DEFINITIONS as Record<string, ListDefinition>)[key]
    : null;
}
