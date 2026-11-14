/**
 * CI URL  ⇄  Next.js route registry.
 *
 * Menu rows (menu_config.URL), header links and old bookmarks all carry CodeIgniter URIs
 * ("controllerFolder/controller[/method[/args]]"). CI turned them into links with
 * site_url($url); here every CI URI is resolved through this ONE table, so:
 *   - the sidebar, header, dashboard tabs and legacy-URL redirects agree on where a module lives;
 *   - a module that has not been migrated yet is reported as such instead of producing a dead link;
 *   - migrating a module = adding its row(s) here — nothing else in the navigation changes.
 *
 * Pattern syntax (CI side): literal segments, `:name` captures one segment.
 * Target syntax (Next side): a path with optional query; `:name` is substituted (URL-encoded).
 * Rows are matched most-specific first (more literal segments win), so a dedicated page such as
 * Bank Name Master (`common/indp_mst_data/index/230`) beats the generic master-data row.
 *
 * Pure module: safe to import from Server and Client Components.
 */

export interface RouteRule {
  /** CI URI pattern, e.g. 'common/indp_mst_data/index/:typeId'. */
  ci: string;
  /** Next href template, e.g. '/common/master-data?typeId=:typeId'. */
  next: string;
  /** Forward only (an old CI link): never used to name the current page, so the screen's own rule — and its menu
   *  grant — governs it. */
  legacy?: boolean;
}

/* ------------------------------------------------------------------------------------------ */
/* Registry — one row per migrated CI screen                                                    */
/* ------------------------------------------------------------------------------------------ */

/** Employee Hub — an employee's record screens (app/(dashboard)/employeeMngt/[screen]); CI opened them as {screen}/index/{emp}. */
const EMP_RECORD_SCREENS: readonly string[] = [
  'employeeMngt/empContactAddress',
  'employeeMngt/emp_education',
  'employeeMngt/emergency_contact_dtl',
  'employeeMngt/emp_email',
  'employeeMngt/emp_phone',
  'employeeMngt/emp_language',
  'employeeMngt/dependent_dtl',
  'employeeMngt/bank_dtl',
  'employeeMngt/emp_nationality',
  'employeeMngt/membership',
  'employeeMngt/empLicence',
  'employeeMngt/empWorkExp',
  'employeeMngt/immigration_dtl',
  'employeeMngt/emp_investments',
  'employeeMngt/emp_reporting',
  'employeeMngt/emp_work_shift',
  'employeeMngt/empReportingLocations',
  'employeeMngt/empPicture',
  'employeeMngt/member_documents',
  'employeeMngt/termination',
];

/** Screens whose Next route is the CI URI itself (module folders were kept 1:1). */
const SAME_PATH: readonly string[] = [
  // Security Manager / user self-service
  'user/user_master',
  'user/role_master',
  'user/user_group',
  'user/user_group_role',
  'user/user_role',
  'user/user_domain',
  'user/user_type_role_mapping',
  'user/login_attempts',
  'user/login_attempts/activeSessions',
  'user/login_details',
  'user/profile',
  'user/changeusername',
  'user/changepassword',
  'user/security_questions',
  // Profile and Permissions
  'user/permission_class',
  'user/permission_dtl',
  'user/permission_class/permissionClassUser',
  'user/permission_class/permissionClassGroup',
  'user/permission_class/permissionClassRole',
  
  // System Settings
  'systmInfoMgr/systm_glssry',
  'systmInfoMgr/systm_lst_dtls',
  'systmInfoMgr/systm_setting',
  'systmInfoMgr/user_lst_login',
  'systmInfoMgr/user_lst_login/LastLoginDetails',
  // Entity Manager
  'entity/entity_obj',
  'entity/entity_obj_attrbt',
  'entity/entity_obj_attrbt_mppng',
  'entity/entity_obj_attrbt_dsply_dtl',
  'entity/entity_obj_attrbt_dependent_data',
  'entity/obj_mppng',
  'entity/obj_attrbt_previleges',
  // Utilities Manager
  'utilities/import_export',
  'utilities/sync_company_settings',
  'utilities/period_manager',
  'utilities/export_employee',
  // Master Data Manager
  'common/common_type',
  // Period Manager
  'periodMngt/period_mst',
  // System Manager — payroll setup and documents
  'systmMngt/salary_component_settings',
  'salaryComponentMember/salarycomponentmember',
  'systmMngt/payComponentTypeConfig',
  'systmMngt/gross_earnings_pay_distribution_config',
  'systmMngt/gross_earnings_pay_distribution_calc',
  'systmMngt/company_documents',
  'systmMngt/document_template',
  'systmMngt/document_templates_variables',
  'payslip/payslip_settings',
  // System Manager — employee salary
  'systmMngt/employee_payment_details',
  'systmMngt/emp_monthly_payment_details',
  'systmMngt/emp_yearly_payment_details',
  // System Manager — organisation & brands
  'systmMngt/oa_brands',
  'systmMngt/org_accounts',
  'systmMngt/oa_brand_settings',
  // Advance Settings
  'vat_registration_settings/vat_registration_settings',
  'exit_form/experience_letter_setting',
  'exit_form/relieving_order_setting',
  'exit_form/exit_form_setting',
  // Employee Hub
  'employeeMngt/emp_mst',
  'employeeMngt/emp_mst/MyTeamEmployee',
  // CI myInfo: a normal user's own Personal form
  'employeeMngt/emp_mst/myInfo',
  // Employee Hub — an employee's records (app/(dashboard)/employeeMngt/[screen])
  ...EMP_RECORD_SCREENS,
  // Payroll — inputs (group P1)
  'advance_salary/advance_salary',
  'incentive/incentive',
  'attndMngt/payroll_summary',
  'outdoor_allowance/outdoor_allowance',
  // Payroll — employee setup and annexures (group P2)
  'employeeMngt/emp_hrprocess',
  'employeeMngt/emp_sal_component_mst/indexAnnexures',
  'employeeMngt/emp_sal_component_mst/annexures',
  // Payroll — payroll run and payslips (group P3)
  'employeeMngt/emp_sal_component_mst',
  'employeeMngt/emp_sal_component_mst/paySlip',
  // Payroll — reports (group P4)
  'employeeMngt/emp_sal_component_mst/viewMonthlySalaryReport',
  'employeeMngt/emp_sal_component_dtl',
  'employeeMngt/emp_sal_component_dtl/SalaryBreakUp',
  'employeeMngt/emp_sal_component_dtl/professionalTax',
  'employeeMngt/emp_sal_component_dtl/MonthlyGrossReport',
  'employeeMngt/emp_sal_component_dtl/MonthlyNetReport',
  // Payroll — Form 16 (group P5); its quarters and settings live under it (app/(dashboard)/form16/form16/**), so the
  // Form 16 menu grant governs them too
  'form16/form16',
  // Employee Hub — Job Detail and its probation worklist (app/(dashboard)/job/job_mst)
  'job/job_mst',
  'job/job_mst/probation',
  // Exit and Clearance Formality (app/(dashboard)/department_activity/department_head_supervisor)
  'department_activity/department_head_supervisor',
  // Timesheet (app/(dashboard)/timesheet/…)
  'timesheet/timesheet',
  'timesheet/timesheet/timesheetBlock',   // "Manage Timesheet" / "Submit for Approval Timesheet"
  'timesheet/timesheet/userProjects',     // "My Projects" / "Configure Projects"
  'timesheet/timesheetItem',              // "Timesheet Item"
  'timesheet/new_timesheet_item',         // "New Timesheet Item"
  'timesheet/timesheet_emp',              // "Timesheet Employee" (Sync Module)
];

/** Screens whose Next folder differs from the CI URI. */
const RENAMED: readonly RouteRule[] = [
  // Dashboard
  { ci: 'dashboard/dashboard', next: '/dashboard' },
  { ci: 'dashboard/dashboard_employee', next: '/dashboard/employee' },
  { ci: 'dashboard/dashboard_attendance', next: '/dashboard/attendance' },
  { ci: 'dashboard/dashboard_leave', next: '/dashboard/leave' },
  { ci: 'dashboard/dashboard_timesheet', next: '/dashboard/timesheet' },
  // Menu tiles page (header "Advance Setting" / "Support Center", menu groups without a URL). The id is
  // a query parameter so the page guard resolves it to this CI URL, not to dashboard/dashboard.
  { ci: 'dashboard/dashboard/ChildMenu/:menuId', next: '/dashboard/child-menu?menuId=:menuId' },
  // Advance Settings — the purchase / sales order headers (other invoice_setting ids are not migrated)
  { ci: 'organisation/invoice_setting/getSpecificSetting/5569', next: '/organisation/invoice_setting?settingId=5569' },
  { ci: 'organisation/invoice_setting/getSpecificSetting/5570', next: '/organisation/invoice_setting?settingId=5570' },
  // Employee Hub — Employee Manager forms (CI index/{status}/{department}/{manager} filters are page state here)
  { ci: 'employeeMngt/emp_mst/addEmployeeMst', next: '/employeeMngt/emp_mst/add' },
  { ci: 'employeeMngt/emp_mst/editEmployeeMst/:id', next: '/employeeMngt/emp_mst/edit/:id' },
  { ci: 'employeeMngt/emp_mst/editEmployeeMst/:id/TEAM_EMP', next: '/employeeMngt/emp_mst/MyTeamEmployee/edit/:id' },
  // Payroll — Employee Details: CI's form (also Employee Manager's "Complete Hr Process") → the employee's row
  { ci: 'employeeMngt/emp_hrprocess/addhrdetails/:emp', next: '/employeeMngt/emp_hrprocess?emp=:emp', legacy: true },
  { ci: 'employeeMngt/emp_hrprocess/addhrdetails/:emp/:fp', next: '/employeeMngt/emp_hrprocess?emp=:emp', legacy: true },
  // Employee Hub — an employee's tabs (CI emp_tabs_v links {screen}/index/{emp})
  ...EMP_RECORD_SCREENS.map((s) => ({ ci: `${s}/index/:emp`, next: `/${s}?emp=:emp`, legacy: true })),
  { ci: 'job/job_mst/index/:emp', next: '/job/job_mst?emp=:emp', legacy: true },
  // Payroll — an employee's annexures (Employee Master tab)
  { ci: 'employeeMngt/emp_sal_component_mst/emp_annexures/:emp', next: '/employeeMngt/emp_sal_component_mst/annexures?emp=:emp' },
  { ci: 'employeeMngt/emp_sal_component_mst/index', next: '/employeeMngt/emp_sal_component_mst' },
  // Payroll — reports: CI's /{emp}/{fy} segments are page state here (0 = not given)
  { ci: 'employeeMngt/emp_sal_component_dtl/index', next: '/employeeMngt/emp_sal_component_dtl' },
  { ci: 'employeeMngt/emp_sal_component_dtl/SalaryBreakUp/:x', next: '/employeeMngt/emp_sal_component_dtl/SalaryBreakUp' },
  { ci: 'employeeMngt/emp_sal_component_dtl/professionalTax/:emp/:fy', next: '/employeeMngt/emp_sal_component_dtl/professionalTax?emp=:emp&fy=:fy' },
  { ci: 'employeeMngt/emp_sal_component_dtl/MonthlyGrossReport/:emp/:fy', next: '/employeeMngt/emp_sal_component_dtl/MonthlyGrossReport?emp=:emp&fy=:fy' },
  { ci: 'employeeMngt/emp_sal_component_dtl/MonthlyNetReport/:emp/:fy', next: '/employeeMngt/emp_sal_component_dtl/MonthlyNetReport?emp=:emp&fy=:fy' },
  // Payroll — investment declarations (group P5): the page lives under Investment Details (its grant governs it)
  { ci: 'employeeMngt/emp_investment_declarations/index/:id', next: '/employeeMngt/emp_investments/declarations?investment=:id', legacy: true },
  { ci: 'employeeMngt/emp_investment_declarations', next: '/employeeMngt/emp_investments', legacy: true },
  { ci: 'employeeMngt/emp_investment_declarations/exportTaxBreakup', next: '/employeeMngt/emp_sal_component_dtl/SalaryBreakUp', legacy: true },
  { ci: 'employeeMngt/emp_investment_declarations/exportMonthlyTaxDeduction', next: '/employeeMngt/emp_sal_component_dtl/SalaryBreakUp', legacy: true },
  { ci: 'employeeMngt/emp_investments/newEmpInvestments/:emp', next: '/employeeMngt/emp_investments/add?emp=:emp', legacy: true },
  { ci: 'employeeMngt/emp_investments/editEmp_investments/:id/:emp', next: '/employeeMngt/emp_investments/edit/:id?emp=:emp', legacy: true },
  { ci: 'employeeMngt/emp_investments/editEmp_investments/:id', next: '/employeeMngt/emp_investments/edit/:id', legacy: true },
  // Payroll — Form 16 (group P5): CI links (forward only)
  { ci: 'form16/form16/newform16detail', next: '/form16/form16/add', legacy: true },
  { ci: 'form16/form16/editform16detail/:id', next: '/form16/form16/edit/:id', legacy: true },
  { ci: 'form16/form16/previewForm16/:id', next: '/form16/form16/edit/:id', legacy: true },
  { ci: 'form16/form16/generateForm16/:id', next: '/form16/form16/edit/:id', legacy: true },
  { ci: 'form16/form16/generateForm16/:id/:emp', next: '/form16/form16/edit/:id', legacy: true },
  { ci: 'form16/form16_quarters', next: '/form16/form16/quarters', legacy: true },
  { ci: 'form16/form16_quarters/newform16quarterdetail', next: '/form16/form16/quarters/add', legacy: true },
  { ci: 'form16/form16_quarters/newform16quarterdetail/:form16', next: '/form16/form16/quarters/add?form16=:form16', legacy: true },
  { ci: 'form16/form16_quarters/editform16quarterdetail/:id', next: '/form16/form16/quarters/edit/:id?from=list', legacy: true },
  { ci: 'form16/form16_quarters/editform16quarterdetail/:id/:form16', next: '/form16/form16/quarters/edit/:id', legacy: true },
  { ci: 'form16/form16_quarter_settings', next: '/form16/form16/quarter_settings', legacy: true },
  { ci: 'form16/form16_quarter_settings/newform16quartersettingsdetail', next: '/form16/form16/quarter_settings/add', legacy: true },
  { ci: 'form16/form16_quarter_settings/editform16quartersettingsdetail/:id', next: '/form16/form16/quarter_settings/edit/:id', legacy: true },
  { ci: 'form16/form16_settings', next: '/form16/form16/settings', legacy: true },
  { ci: 'form16/form16_settings/index/:code', next: '/form16/form16/settings', legacy: true },
  { ci: 'form16/form16_settings/newPayslipSettings', next: '/form16/form16/settings', legacy: true },
  { ci: 'form16/form16_settings/editPayslip_settings/:id', next: '/form16/form16/settings', legacy: true },
  // Advance Settings — benefit rules, one list per rule type (CI index() defaulted to BRTYSBR)
  { ci: 'benefitrules/benefitrules/index/:type', next: '/benefitrules/benefitrules?type=:type' },
  { ci: 'benefitrules/benefitrules', next: '/benefitrules/benefitrules?type=BRTYSBR' },
  // Timesheet — CI index/{status}/{period} and MyTeamTimesheet/{status}/{period} filters are query
  // parameters here (status = the CI master id, so the menu entries such as index/6970 still match).
  { ci: 'timesheet/timesheet/index/:status', next: '/timesheet/timesheet?status=:status' },
  { ci: 'timesheet/timesheet/index/:status/:period', next: '/timesheet/timesheet?status=:status&period=:period' },
  { ci: 'timesheet/timesheet/index/:status/:period/TIMESHEET_PERIOD', next: '/timesheet/timesheet?status=:status&period=:period' },
  { ci: 'timesheet/timesheet/newTimesheet', next: '/timesheet/timesheet/add' },
  { ci: 'timesheet/timesheet/editTimesheet/:id', next: '/timesheet/timesheet/edit/:id' },
  { ci: 'timesheet/timesheet/MyTeamTimesheet', next: '/timesheet/timesheet/team' },
  { ci: 'timesheet/timesheet/MyTeamTimesheet/:status', next: '/timesheet/timesheet/team?status=:status' },
  { ci: 'timesheet/timesheet/MyTeamTimesheet/:status/:period', next: '/timesheet/timesheet/team?status=:status&period=:period' },
  {
    ci: 'timesheet/timesheet/MyTeamTimesheet/:status/:period/TIMESHEET_PERIOD',
    next: '/timesheet/timesheet/team?status=:status&period=:period',
  },
  { ci: 'timesheet/timesheet/newTimesheet/:period/TEAM', next: '/timesheet/timesheet/team/add' },
  { ci: 'timesheet/timesheet/editTimesheet/:id/:status/TEAM', next: '/timesheet/timesheet/team/edit/:id' },
  // CI timesheetBlock/{monthOffset}/{empId} and userProjects/{userId}: the month / employee are page state here.
  { ci: 'timesheet/timesheet/timesheetBlock/:offset', next: '/timesheet/timesheet/timesheetBlock' },
  { ci: 'timesheet/timesheet/timesheetBlock/:offset/:empId', next: '/timesheet/timesheet/timesheetBlock' },
  { ci: 'timesheet/timesheet/userProjects/:userId', next: '/timesheet/timesheet/userProjects?userId=:userId' },
  // Timesheet items (CI timesheetItem/newTmshtItem/{tsId}/{oaId}/{brandId}/{userId}, editTmshtItem/{id}/…)
  { ci: 'timesheet/timesheetItem/newTmshtItem', next: '/timesheet/timesheetItem/add' },
  { ci: 'timesheet/timesheetItem/newTmshtItem/:tsId', next: '/timesheet/timesheetItem/add?tsId=:tsId' },
  { ci: 'timesheet/timesheetItem/newTmshtItem/:tsId/:oaId/:brandId/:userId', next: '/timesheet/timesheetItem/add?tsId=:tsId' },
  { ci: 'timesheet/timesheetItem/editTmshtItem/:id', next: '/timesheet/timesheetItem/edit/:id' },
  { ci: 'timesheet/timesheetItem/editTmshtItem/:id/:tsId', next: '/timesheet/timesheetItem/edit/:id' },
  { ci: 'timesheet/timesheetItem/editTmshtItem/:id/:tsId/:oaId/:brandId/:userId', next: '/timesheet/timesheetItem/edit/:id' },
  { ci: 'timesheet/new_timesheet_item/index/:date', next: '/timesheet/new_timesheet_item?date=:date' },
  { ci: 'timesheet/timesheet_emp/index/:status', next: '/timesheet/timesheet_emp?status=:status' },
  { ci: 'timesheet/timesheet_emp/editTimesheetEmp/:id', next: '/timesheet/timesheet_emp/edit/:id' },
  { ci: 'timesheet/timesheet_emp/editTimesheetEmp/:id/TEAM', next: '/timesheet/timesheet_emp/edit/:id' },
  // Bank Manager
  { ci: 'bankmanager/bankdetails', next: '/bank-manager/bank-details' },
  { ci: 'bankmanager/sheetimport', next: '/bank-manager/bank-transaction' },
  { ci: 'bankmanager/bankstatementsetting', next: '/bank-manager/bank-statement-setting' },
  { ci: 'common/indp_mst_data/index/230', next: '/bank-manager/bank-name-master' },
  // Master Data Manager
  { ci: 'common/indp_mst_data/index/:typeId', next: '/common/master-data?typeId=:typeId' },
  { ci: 'common/indp_mst_data', next: '/common/master-data' },
  { ci: 'common/common_type/Masters', next: '/common/common_type' },
  { ci: 'common/config_mapping_dtl/index/:typeId', next: '/common/config-mapping?typeId=:typeId' },
  { ci: 'common/config_mapping_dtl', next: '/common/config-mapping' },
  { ci: 'common/modulesync', next: '/common/module-sync' },
  // Security Manager
  { ci: 'authoritylevel/authoritylevel', next: '/user/authoritylevel' },
  // Setting Manager (CI change_module_settings/index/{module}/{funcArea}/{group}/{CS|SS})
  { ci: 'setting_manager/change_module_settings', next: '/setting_manager/change_module_settings' },
  { ci: 'setting_manager/change_module_settings/index/0/0/0/CS', next: '/setting_manager/change_module_settings?screen=CS' },
  { ci: 'setting_manager/change_module_settings/index/0/0/0/SS', next: '/setting_manager/change_module_settings?screen=SS' },
  {
    ci: 'setting_manager/change_module_settings/index/:moduleId/:funcAreaId/:settingGroupId',
    next: '/setting_manager/change_module_settings?moduleId=:moduleId&funcAreaId=:funcAreaId&settingGroupId=:settingGroupId',
  },
  // Profile and Permissions (CI's permission form lived in the permission_dtl controller)
  { ci: 'user/permission_dtl/newPermissionDtl', next: '/user/permission_class/add' },
  { ci: 'user/permission_dtl/editPermissionDtl/:id', next: '/user/permission_class/edit/:id' },
  // Utilities Manager
  { ci: 'utilities/dashboard_menu', next: '/utilities/dashboard-menu' },
  // Period Manager. changeType/{type} is listed before index/{type}: both open the same page, and
  // the reverse lookup (active menu item + permission) must find the "… Period Details" menu entries.
  { ci: 'periodMngt/period_mst/changeType/:periodTypeId', next: '/periodMngt/period_mst?periodTypeId=:periodTypeId' },
  { ci: 'periodMngt/period_mst/index/:periodTypeId', next: '/periodMngt/period_mst?periodTypeId=:periodTypeId' },
  {
    ci: 'periodMngt/period_mst/index/:periodTypeId/:periodStatusId',
    next: '/periodMngt/period_mst?periodTypeId=:periodTypeId&periodStatusId=:periodStatusId',
  },
  { ci: 'periodMngt/period_mst/addPeriod', next: '/periodMngt/period_mst/add' },
  { ci: 'periodMngt/period_mst/editPeriod/:id', next: '/periodMngt/period_mst/edit/:id' },
  // System Manager — payroll setup
  { ci: 'systmMngt/salary_component_settings/addSalaryComponentSettings', next: '/systmMngt/salary_component_settings/add' },
  { ci: 'systmMngt/salary_component_settings/editSalaryComponentSettings/:id', next: '/systmMngt/salary_component_settings/edit/:id' },
  { ci: 'systmMngt/payComponentTypeConfig/editPayComponentTypeConfig/:id', next: '/systmMngt/payComponentTypeConfig' },
  { ci: 'systmMngt/gross_earnings_pay_distribution_config/editGrossEarningsPay/:id', next: '/systmMngt/gross_earnings_pay_distribution_config' },
  { ci: 'systmMngt/payslip_setting', next: '/payslip/payslip_settings' },
  { ci: 'payslip/payslip_settings/newPayslipSettings', next: '/payslip/payslip_settings' },
  { ci: 'payslip/payslip_settings/editPayslip_settings/:id', next: '/payslip/payslip_settings' },
  // System Manager — employee salary
  { ci: 'systmMngt/employee_payment_details/index/:empId', next: '/systmMngt/employee_payment_details?empId=:empId' },
  { ci: 'systmMngt/employee_payment_details/displayDetails/:empId', next: '/systmMngt/employee_payment_details?empId=:empId' },
  { ci: 'systmMngt/employee_payment_details/editEmployeePayment/:id', next: '/systmMngt/employee_payment_details/edit/:id' },
  // System Manager — organisation & brands
  { ci: 'systmMngt/org_accounts/editOrgAccounts/:id', next: '/systmMngt/org_accounts/edit/:id' },
  { ci: 'systmMngt/oa_brands/MyDashboard', next: '/systmMngt/oa_brands/my_dashboard' },
  { ci: 'systmMngt/oa_brands/editOaBrands/:id', next: '/systmMngt/oa_brands/edit/:id' },
  { ci: 'systmMngt/oa_brands/index/:oaId', next: '/systmMngt/oa_brands' },
  { ci: 'systmMngt/oa_brands/switchBrandForPartners/:oaId', next: '/systmMngt/oa_brands/my_dashboard?view=partner' },
  { ci: 'systmMngt/oa_brands/switchBrandForAccountant/:oaId', next: '/systmMngt/oa_brands/my_dashboard?view=accountant' },
  {
    ci: 'systmMngt/oa_brand_settings/index/:brandId/:type',
    next: '/systmMngt/oa_brand_settings?brandId=:brandId&type=:type',
  },
  { ci: 'systmMngt/oa_brand_settings/index/:brandId', next: '/systmMngt/oa_brand_settings?brandId=:brandId' },
  { ci: 'systmMngt/oa_brand_settings/newOabBrandSettings/:brandId/:type', next: '/systmMngt/oa_brand_settings/add?brandId=:brandId&type=:type' },
  { ci: 'systmMngt/oa_brand_settings/editOaBrandSettings/:id/:brandId/:type', next: '/systmMngt/oa_brand_settings/edit/:id' },
  // System Manager — documents (CI's company document form lived in user/member_file_upload, BRAND_ID path)
  { ci: 'systmMngt/company_documents/index/:oaBrandId', next: '/systmMngt/company_documents' },
  { ci: 'user/member_file_upload/newFileUpload/:oaBrandId/BRAND_ID', next: '/systmMngt/company_documents/add' },
  { ci: 'user/member_file_upload/editFileUpload/:id/:oaBrandId/BRAND_ID', next: '/systmMngt/company_documents/edit/:id' },
  { ci: 'systmMngt/document_template/newDocumentTemplate', next: '/systmMngt/document_template/add' },
  { ci: 'systmMngt/document_template/editDocument_template/:id', next: '/systmMngt/document_template/edit/:id' },
  { ci: 'systmMngt/document_templates_variables/newDocumentTemplatesVariables', next: '/systmMngt/document_templates_variables/add' },
  {
    ci: 'systmMngt/document_templates_variables/editDocument_templates_variables/:id',
    next: '/systmMngt/document_templates_variables/edit/:id',
  },
];

export const ROUTE_RULES: readonly RouteRule[] = [
  ...RENAMED,
  ...SAME_PATH.map((p) => ({ ci: p, next: `/${p}` })),
];

/* ------------------------------------------------------------------------------------------ */
/* Resolution                                                                                   */
/* ------------------------------------------------------------------------------------------ */

export type ResolvedLink =
  /** Menu group without a page of its own (CI URL '' or '#'). */
  | { kind: 'none' }
  /** Absolute URL (CI: parse_url(URL, PHP_URL_SCHEME) → used as-is). */
  | { kind: 'external'; href: string }
  /** Migrated screen. */
  | { kind: 'internal'; href: string; ciPath: string }
  /** Valid CI screen that has no Next.js page yet. */
  | { kind: 'unavailable'; ciPath: string };

interface CompiledRule {
  rule: RouteRule;
  segments: string[];
  literalCount: number;
}

const COMPILED: CompiledRule[] = ROUTE_RULES.map((rule) => {
  const segments = splitPath(rule.ci);
  return { rule, segments, literalCount: segments.filter((s) => !s.startsWith(':')).length };
}).sort((a, b) => b.literalCount - a.literalCount || b.segments.length - a.segments.length);

function splitPath(path: string): string[] {
  return path.split('/').filter(Boolean);
}

/**
 * Normalises a CI URI the way CI routing sees it: no leading slash / index.php, no query,
 * no trailing slash, and a trailing default method `/index` dropped ('x/y/index' ≡ 'x/y').
 */
export function normalizeCiPath(raw: string): string {
  let p = raw.trim().split(/[?#]/)[0];
  p = p.replace(/^\/+/, '').replace(/^index\.php\/?/i, '');
  const segments = splitPath(p);
  if (segments.length === 3 && segments[2] === 'index') segments.pop();
  return segments.join('/');
}

function matchRule(ciPath: string): { rule: RouteRule; captures: Record<string, string> } | null {
  const segments = splitPath(ciPath);
  for (const c of COMPILED) {
    if (c.segments.length !== segments.length) continue;
    const captures: Record<string, string> = {};
    const ok = c.segments.every((seg, i) => {
      if (seg.startsWith(':')) {
        captures[seg.slice(1)] = segments[i];
        return true;
      }
      return seg === segments[i];
    });
    if (ok) return { rule: c.rule, captures };
  }
  return null;
}

function fillTemplate(template: string, captures: Record<string, string>): string {
  return template.replace(/:([A-Za-z_]\w*)/g, (_, name: string) => encodeURIComponent(captures[name] ?? ''));
}

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/** Resolves a CI URL (menu_config.URL, header link, bookmark) to where it lives in this app. */
export function resolveCiUrl(raw: string | null | undefined): ResolvedLink {
  const value = (raw ?? '').trim();
  if (value === '' || value === '#') return { kind: 'none' };
  if (SCHEME.test(value)) return { kind: 'external', href: value };

  const ciPath = normalizeCiPath(value);
  if (ciPath === '') return { kind: 'none' };
  const match = matchRule(ciPath);
  if (!match) return { kind: 'unavailable', ciPath };
  return { kind: 'internal', href: fillTemplate(match.rule.next, match.captures), ciPath };
}

/** Convenience for header links: the Next href, or null when the screen is not available. */
export function hrefForCi(raw: string): string | null {
  const r = resolveCiUrl(raw);
  return r.kind === 'internal' || r.kind === 'external' ? r.href : null;
}

/* ------------------------------------------------------------------------------------------ */
/* Reverse lookup (Next path → CI screen) — active state & permission guard                     */
/* ------------------------------------------------------------------------------------------ */

interface ParsedHref {
  path: string;
  query: URLSearchParams;
}

export function parseHref(href: string): ParsedHref {
  const [path, qs = ''] = href.split('?');
  return { path: path.replace(/\/+$/, '') || '/', query: new URLSearchParams(qs) };
}

/**
 * How well `href` (a menu target) describes the current location; 0 = not at all.
 * A page matches its own path and its sub-pages (add / edit/[id] / details); every query
 * parameter the menu target pins (e.g. typeId) must be present with the same value.
 * Longer paths and pinned queries score higher, so the most specific menu entry wins.
 */
export function matchScore(href: string, pathname: string, search: URLSearchParams): number {
  const target = parseHref(href);
  const current = pathname.replace(/\/+$/, '') || '/';
  const isSelf = current === target.path;
  const isChild = target.path !== '/' && current.startsWith(`${target.path}/`);
  if (!isSelf && !isChild) return 0;
  for (const [key, value] of target.query) {
    if (search.get(key) !== value) return 0;
  }
  return target.path.length * 10 + (isSelf ? 5 : 0) + [...target.query.keys()].length;
}

/**
 * The CI menu URL that governs the page at `pathname` — used to evaluate the same
 * permission_dtl FUNCTION grant CI used for the menu item. null = not a menu screen.
 */
export function ciUrlForLocation(pathname: string, search: URLSearchParams): string | null {
  let best: { score: number; ci: string } | null = null;
  for (const c of COMPILED) {
    if (c.rule.legacy) continue;
    // Rules with captures are reversed through their query / path parameters.
    const captures: Record<string, string> = {};
    const target = parseHref(c.rule.next);
    let complete = true;
    for (const [key, value] of target.query) {
      if (!value.startsWith(':')) continue;
      const v = search.get(key);
      if (!v) complete = false;
      else captures[value.slice(1)] = v;
    }
    if (!complete || /:[A-Za-z_]/.test(target.path)) continue;
    // A legacy-only rule whose CI parameters the Next URL does not carry (e.g. editX/:id → a page
    // without the id) cannot name the CI screen: skip it so the plain screen rule wins.
    if (c.segments.some((s) => s.startsWith(':') && !(s.slice(1) in captures))) continue;
    const href = fillTemplate(c.rule.next, captures);
    const score = matchScore(href, pathname, search);
    if (score > 0 && (!best || score > best.score)) {
      best = { score, ci: fillTemplate(c.rule.ci, captures) };
    }
  }
  return best?.ci ?? null;
}
