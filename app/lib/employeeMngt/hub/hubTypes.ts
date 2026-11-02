/**
 * Employee Hub record screens (CI employeeMngt/* sub-records of an employee: Address, Education, …) —
 * client-safe shapes shared by lib/employeeMngt/hub (server) and app/(dashboard)/employeeMngt/[screen].
 */

export type HubScreenKey =
  | 'empContactAddress'
  | 'emp_education'
  | 'emergency_contact_dtl'
  | 'emp_email'
  | 'emp_phone'
  | 'emp_language'
  | 'dependent_dtl'
  | 'bank_dtl'
  | 'emp_nationality'
  | 'membership'
  | 'empLicence'
  | 'empWorkExp'
  | 'immigration_dtl'
  | 'emp_investments'
  | 'job_mst'
  | 'emp_reporting'
  | 'emp_work_shift'
  | 'empReportingLocations'
  | 'empPicture'
  | 'member_documents'
  | 'job_probation';

export interface HubScreenInfo {
  /** CI menu URL — its permission_dtl grant governs the screen. */
  menu: string;
  /** Menu / list title. */
  title: string;
  /** CI list view whose Form Settings label and hide the columns / fields. */
  objectName: string;
  /** "Employee Education" → "Add Employee Education" / "Edit Employee Education". */
  noun: string;
  /** Page path when it is not /employeeMngt/<key> (Job Detail lives under job/). */
  base?: string;
}

export const HUB_SCREENS: Record<HubScreenKey, HubScreenInfo> = {
  empContactAddress: { menu: 'employeeMngt/empContactAddress', title: 'Address', objectName: 'contact_address_vw', noun: 'Employee Address' },
  emp_education: { menu: 'employeeMngt/emp_education', title: 'Education', objectName: 'emp_education_vw', noun: 'Employee Education' },
  emergency_contact_dtl: {
    menu: 'employeeMngt/emergency_contact_dtl', title: 'Emergency Contacts', objectName: 'emergency_contact_dtl_vw', noun: 'Emergency Contact',
  },
  emp_email: { menu: 'employeeMngt/emp_email', title: 'Employee Email', objectName: 'oa_contact_emails_vw', noun: 'Employee Email' },
  emp_phone: { menu: 'employeeMngt/emp_phone', title: 'Employee Phone', objectName: 'oa_contact_phones_vw', noun: 'Employee Phone' },
  emp_language: { menu: 'employeeMngt/emp_language', title: 'Languages Known', objectName: 'emp_language_vw', noun: 'Employee Language' },
  dependent_dtl: { menu: 'employeeMngt/dependent_dtl', title: 'Dependents', objectName: 'dependent_dtl_vw', noun: 'Dependent' },
  bank_dtl: { menu: 'employeeMngt/bank_dtl', title: 'Bank Accounts', objectName: 'bank_dtl_vw', noun: 'Bank Account' },
  emp_nationality: { menu: 'employeeMngt/emp_nationality', title: 'Nationality', objectName: 'oa_contact_nationality_vw', noun: 'Nationality' },
  membership: { menu: 'employeeMngt/membership', title: 'Membership', objectName: 'membership_vw', noun: 'Membership' },
  empLicence: { menu: 'employeeMngt/empLicence', title: 'Licences', objectName: 'emp_licence_vw', noun: 'Employee Licence' },
  empWorkExp: { menu: 'employeeMngt/empWorkExp', title: 'Work Experience', objectName: 'emp_work_experience_vw', noun: 'Work Experience' },
  immigration_dtl: {
    menu: 'employeeMngt/immigration_dtl', title: 'Regulatory Requirement', objectName: 'immigration_dtl_vw', noun: 'Regulatory Requirement',
  },
  emp_investments: {
    menu: 'employeeMngt/emp_investments', title: 'Investment Details', objectName: 'investment_mst_declaration_vw', noun: 'Investment Details',
  },
  emp_reporting: { menu: 'employeeMngt/emp_reporting', title: 'Employee Reporting', objectName: 'emp_reporting_vw', noun: 'Employee Reporting' },
  emp_work_shift: { menu: 'employeeMngt/emp_work_shift', title: 'Work Shifts', objectName: 'emp_work_shift_vw', noun: 'Work Shift' },
  empReportingLocations: {
    menu: 'employeeMngt/empReportingLocations', title: 'Work Locations', objectName: 'emp_reporting_locations_vw', noun: 'Work Location',
  },
  empPicture: { menu: 'employeeMngt/empPicture', title: 'My Picture', objectName: 'emp_picture_vw', noun: 'Employee Picture' },
  member_documents: { menu: 'employeeMngt/member_documents', title: 'Member Documents', objectName: 'member_attachment_vw', noun: 'Member Document' },
  job_mst: { menu: 'job/job_mst', title: 'Job Detail', objectName: 'job_mst_vw', noun: 'Job Detail', base: '/job/job_mst' },
  job_probation: {
    menu: 'job/job_mst/probation', title: 'Confirmation Pending', objectName: 'job_mst_vw', noun: 'Job Detail', base: '/job/job_mst/probation',
  },
};

export const isHubScreen = (key: string): key is HubScreenKey => Object.prototype.hasOwnProperty.call(HUB_SCREENS, key);

export const hubBase = (key: HubScreenKey) => HUB_SCREENS[key].base ?? `/employeeMngt/${key}`;

export interface HubOption {
  value: number | string;
  label: string;
  /** For a field that depends on another: the other field's value this option belongs to. */
  parent?: number | string;
}

export type HubValues = Record<string, string | boolean>;

/** GET /api/employeeMngt/[screen]/form — everything the add / edit form needs. */
export interface HubFormModel {
  /** Dropdown lists by name. */
  options: Record<string, HubOption[]>;
  /** The employees the caller may pick (a normal user: themself only). */
  employees: HubOption[];
  /** The caller's own employee in the active brand (preselected for a normal user). */
  ownEmployeeId: number | null;
  /** Normal user (CI is_admin 0): the employee is fixed to themself. */
  restricted: boolean;
  /** Screen-specific settings (e.g. whether the brand is in India). */
  flags: Record<string, boolean>;
  /** Initial values of the add form. */
  defaults: HubValues;
}
