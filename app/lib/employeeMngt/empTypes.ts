import type { IdLabel } from '@/lib/systmMngt/shared';

/**
 * Employee Manager / Team Employee Manager (CI employeeMngt/emp_mst) — the screens, field rules and
 * data shapes shared by the pages and the API (no server imports). Services: ./empList, ./empMst.
 */

export const EMP_SCREENS = {
  /** CI index(): every employee in scope. */
  all: { menu: 'employeeMngt/emp_mst', title: 'Employee Manager', base: '/employeeMngt/emp_mst' },
  /** CI MyTeamEmployee(): the employees a manager (or HR executive) looks after. */
  team: { menu: 'employeeMngt/emp_mst/MyTeamEmployee', title: 'Team Employee Manager', base: '/employeeMngt/emp_mst/MyTeamEmployee' },
} as const;

export type EmpScreen = keyof typeof EMP_SCREENS;

/** One list row — the columns of CI's emp_manager_new_vw that the list shows. */
export interface EmpRow {
  id: number;
  EMP_NBR: string | null;
  TITLE_NM: string | null;
  EMP_NAME: string | null;
  EMP_MIDDLE_NM: string | null;
  EMPLST_NM: string | null;
  EMP_FULL_NAME: string | null;
  EMP_INITIALS: string | null;
  KNOWN_AS: string | null;
  IS_MANAGER: string;
  MANAGER: string | null;
  DEPARTMENT: string | null;
  EMP_STATUS: string | null;
  GENDER: string | null;
  DOB: string | null;
  EMAIL_ADD: string | null;
  FULL_PHONE_NBR: string | null;
  OA_BRAND_CD: string | null;
}

export interface EmpFilterModel {
  statuses: IdLabel[];
  /** "Select All" (ESALL): no status filter. */
  allStatusId: number | null;
  currentStatusId: number | null;
  departments: IdLabel[];
  /** CI shows the Manager filter to admins only. */
  managers: IdLabel[] | null;
  /** CI shows the Department / Status filters to admins on Employee Manager, to everyone on Team. */
  showFilters: boolean;
}

/** Form values (CI initForm controls, school-edition and picture fields excluded). */
export type EmpValues = {
  EMP_NBR: string;
  title: string;
  EMP_NAME: string;
  cntctMddlNm: string;
  cntctLstNm: string;
  known_as: string;
  EMP_INITIALS: string;
  email: string;
  COUNTRY_CODE: string;
  phone: string;
  dob: string;
  cntctSmoker: boolean;
  EmployementStatus: string;
  cntctGenderId: string;
  marritalStatusId: string;
  marriage_date: string;
  maiden_name: string;
  castId: string;
  raseId: string;
  ethinicity: string;
  bloodgrp: string;
  isManager: boolean;
  managerId: string;
  hrExecutiveId: string;
  taxAllowType: string;
  ext_ref_emp_no: string;
  tax_ref_no: string;
  IS_DISABLE: boolean;
  ni_table: string;
  EMP_SSN_NBR: string;
  EMP_SIN_NBR: string;
  EMP_PAN_NBR: string;
  EMP_SKYPE_ID: string;
  EMP_DRI_LICE_NBR: string;
  EMP_DRI_LICE_EXP_DATE: string;
  careerStream: string;
  EMP_MILITARY_SERVICE: boolean;
  IS_DIRECTOR: boolean;
  IS_BUSINESS_OWNER: boolean;
  IS_PSC: boolean;
  IS_SHAREHOLDER: boolean;
};

/**
 * Fields a normal user (is_admin 0) sees read-only — CI rendered them readonly / disabled for
 * is_admin == 0; here the API also refuses to change them. Status is read-only for everyone on edit.
 */
export const USER_READ_ONLY: ReadonlyArray<keyof EmpValues> = [
  'EMP_NBR', 'EMP_NAME', 'cntctLstNm', 'known_as', 'EMP_INITIALS', 'email', 'COUNTRY_CODE', 'phone', 'dob',
  'isManager', 'managerId', 'hrExecutiveId', 'EMP_MILITARY_SERVICE', 'IS_DIRECTOR', 'IS_BUSINESS_OWNER', 'IS_PSC', 'IS_SHAREHOLDER',
];

export interface EmpFormOptions {
  titles: IdLabel[];
  countryCodes: IdLabel[];
  statuses: IdLabel[];
  genders: IdLabel[];
  maritalStatuses: IdLabel[];
  castes: IdLabel[];
  races: IdLabel[];
  ethnicities: IdLabel[];
  bloodGroups: IdLabel[];
  managers: IdLabel[];
  hrExecutives: IdLabel[];
  taxAllowanceTypes: IdLabel[];
  careerStreams: IdLabel[];
}

export interface EmpFormModel {
  options: EmpFormOptions;
  /** CI: Caste / Race only for India brands. */
  showCasteRace: boolean;
  /** The caller is a normal user: USER_READ_ONLY fields are read-only. */
  restricted: boolean;
  /** CI's preselected phone country code (+91). */
  defaultCountryCode: number | null;
  /** The caller's own employee in the active brand (My Info). */
  ownEmployeeId: number | null;
}

/** CI dlnumber_valid: letters, digits and slashes, not only digits. */
export function isValidDrivingLicence(value: string): boolean {
  return /^[a-zA-Z0-9/]+$/.test(value) && !/^\d+$/.test(value);
}
