import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/http/errors';
import { getMasterId, getMasterOptionsByType, getMasterOptionsByTypeCode } from '@/lib/masters/masterService';
import { prisma } from '@/lib/prisma';
import { menuPolicy } from '@/lib/resource/policies';
import { activeBrand, brandOrgId, type IdLabel } from '@/lib/systmMngt/shared';
import { linkEmail, linkPhone, type ContactOwner } from './empContacts';
import { EMAIL_EXPR, PHONE_EXPR, SqlBuilder, managerOptions, scopeFor } from './empList';
import {
  EMP_SCREENS,
  USER_READ_ONLY,
  isValidDrivingLicence,
  type EmpFormModel,
  type EmpFormOptions,
  type EmpScreen,
  type EmpValues,
} from './empTypes';

/**
 * CI employeeMngt/emp_mst addEmployeeMst / editEmployeeMst (initForm, the "Personal" tab), insert,
 * update and delete. An employee is reachable when it is in the caller's Employee Manager or Team
 * Employee Manager scope (lib/employeeMngt/empList) and the caller holds that menu's grant.
 *
 * Saving also links the e-mail / phone through the contact tables (./empContacts) — or, for an employee
 * without a login user, keeps the raw value as some migrated rows do — keeps the line manager in
 * emp_reporting, and (update) renames the employee's contact.
 *
 * Behaviour changes, all security or data fixes:
 *  - every read and write is scoped (CI loaded / updated / deleted any EMP_ID, from a posted id);
 *  - the fields CI showed read-only to normal users (codes, names, e-mail, phone, birth date, manager,
 *    HR executive, the director / PSC / shareholder flags) cannot be changed by them; status cannot be
 *    changed on edit by anyone (CI only disabled the input);
 *  - a new employee is Current unless chosen otherwise; Employee Code is required and unique in the
 *    brand; the picture, IS_DISABLE, NI table and career stream are no longer lost or swapped on save;
 *  - the record keeps its owner (USER_ID) and brand (CI re-stamped them with the editor's);
 *  - only the line-manager row of emp_reporting is updated (CI overwrote every reporting row's type);
 *  - delete is for admins only, as a scoped soft delete.
 */

/** Column → SQL type of every emp_mst column the form writes. */
const COLUMN_TYPES = {
  EMP_NBR: 'text', REF_EMP_NBR: 'integer', TITLE: 'integer', EMP_NAME: 'text', EMP_MIDDLE_NM: 'text', EMPLST_NM: 'text',
  KNOWN_AS: 'text', EMP_INITIALS: 'text', COUNTRY_CODE: 'text', DOB: 'date', IS_SMOKER: 'smallint', EMP_STATUS_ID: 'integer',
  GENDER_ID: 'integer', MARITAL_STATUS_ID: 'integer', MARRIAGE_DATE: 'date', MAIDEN_NAME: 'text', CAST_ID: 'integer',
  RAISE_ID: 'integer', ETHINICITY_ID: 'integer', BLOOD_GRP: 'text', IS_MANAGER: 'text', MANAGER_ID: 'integer',
  HR_EXECUTIVE_ID: 'integer', TAX_ALLOWANCE_TYPE_ID: 'integer', EXT_REF_EMP_NO: 'text', TAX_REF_NO: 'text', IS_DISABLE: 'smallint',
  NI_TABLE: 'text', EMP_SSN_NBR: 'text', EMP_SIN_NBR: 'text', EMP_PAN_NBR: 'text', SKYPE_ID: 'text', EMP_DRI_LICE_NBR: 'text',
  EMP_DRI_LICE_EXP_DATE: 'date', CAREERSTREAM_ID: 'integer', EMP_MILITARY_SERVICE: 'text', IS_DIRECTOR: 'smallint',
  IS_BUSINESS_OWNER: 'smallint', IS_PSC: 'smallint', IS_SHAREHOLDER: 'smallint', OA_CNTCT_EML_ID: 'text', OA_CNTCT_PHONE_ID: 'text',
} as const;

type Column = keyof typeof COLUMN_TYPES;
type Row = Record<string, unknown> & { EMP_ID: number; REF_EMP_ID: number | null; OA_BRAND_ID: number; OA_ID: number | null };

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
const yes = (v: unknown) => /^\s*0*1(\.0*)?\s*$/.test(s(v));

/** The record, if the caller may perform `action` on it through one of the two screens. */
async function findAccessible(subject: RequestSubject, empId: number, action: 'read' | 'update' | 'delete'): Promise<Row> {
  for (const screen of ['all', 'team'] as EmpScreen[]) {
    if (!(await menuPolicy(EMP_SCREENS[screen].menu).check(subject, action))) continue;
    const sql = new SqlBuilder();
    const scope = await scopeFor(subject, screen, sql);
    const rows = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT em.*, to_char(em."DOB", 'YYYY-MM-DD') AS dob_text, to_char(em."MARRIAGE_DATE", 'YYYY-MM-DD') AS marriage_text,
              to_char(em."EMP_DRI_LICE_EXP_DATE", 'YYYY-MM-DD') AS dl_exp_text, ${EMAIL_EXPR} AS email_text, ${PHONE_EXPR} AS phone_text
       FROM emp_mst em WHERE em."EMP_ID" = ${sql.p(empId)} AND em."IS_DELETED" = 0 AND ${scope} LIMIT 1`,
      ...sql.params,
    );
    if (rows[0]) return rows[0];
  }
  throw new NotFoundError('Employee not found.');
}

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new NotFoundError('Employee not found.');
  return id;
}

/** A coded column: CI saved 0 for "nothing selected". */
const code = (v: unknown) => (v == null || Number(v) === 0 ? '' : String(v));

function toValues(r: Row): EmpValues {
  return {
    EMP_NBR: s(r.EMP_NBR), title: code(r.TITLE), EMP_NAME: s(r.EMP_NAME), cntctMddlNm: s(r.EMP_MIDDLE_NM), cntctLstNm: s(r.EMPLST_NM),
    known_as: s(r.KNOWN_AS), EMP_INITIALS: s(r.EMP_INITIALS), email: s(r.email_text), COUNTRY_CODE: code(r.COUNTRY_CODE),
    phone: s(r.phone_text), dob: s(r.dob_text), cntctSmoker: Number(r.IS_SMOKER) === 1, EmployementStatus: code(r.EMP_STATUS_ID),
    cntctGenderId: code(r.GENDER_ID), marritalStatusId: code(r.MARITAL_STATUS_ID), marriage_date: s(r.marriage_text),
    maiden_name: s(r.MAIDEN_NAME), castId: code(r.CAST_ID), raseId: code(r.RAISE_ID), ethinicity: code(r.ETHINICITY_ID), bloodgrp: code(r.BLOOD_GRP),
    isManager: yes(r.IS_MANAGER), managerId: code(r.MANAGER_ID), hrExecutiveId: code(r.HR_EXECUTIVE_ID), taxAllowType: code(r.TAX_ALLOWANCE_TYPE_ID),
    ext_ref_emp_no: s(r.EXT_REF_EMP_NO), tax_ref_no: s(r.TAX_REF_NO), IS_DISABLE: Number(r.IS_DISABLE) === 1, ni_table: s(r.NI_TABLE),
    EMP_SSN_NBR: s(r.EMP_SSN_NBR), EMP_SIN_NBR: s(r.EMP_SIN_NBR), EMP_PAN_NBR: s(r.EMP_PAN_NBR), EMP_SKYPE_ID: s(r.SKYPE_ID),
    EMP_DRI_LICE_NBR: s(r.EMP_DRI_LICE_NBR), EMP_DRI_LICE_EXP_DATE: s(r.dl_exp_text), careerStream: code(r.CAREERSTREAM_ID),
    EMP_MILITARY_SERVICE: yes(r.EMP_MILITARY_SERVICE), IS_DIRECTOR: Number(r.IS_DIRECTOR) === 1,
    IS_BUSINESS_OWNER: Number(r.IS_BUSINESS_OWNER) === 1, IS_PSC: Number(r.IS_PSC) === 1, IS_SHAREHOLDER: Number(r.IS_SHAREHOLDER) === 1,
  };
}

/** CI getAllHRExcutiveEmp(): employees whose user holds the HR Executive / HR Managerial Service class in the brand. */
async function hrExecutiveOptions(brand: number): Promise<IdLabel[]> {
  const [userRef, he, hm] = await Promise.all([getMasterId('PRTUP'), getMasterId('PCHE'), getMasterId('PCHM')]);
  const rows = await prisma.$queryRaw<Array<{ value: number; label: string }>>`
    SELECT DISTINCT ON (em."EMP_ID") em."EMP_ID" AS value,
           btrim(regexp_replace(COALESCE(em."EMP_NAME", '') || ' ' || COALESCE(em."EMP_MIDDLE_NM", '') || ' ' || COALESCE(em."EMPLST_NM", ''), '\s+', ' ', 'g')) AS label
    FROM permission_dtl pd JOIN emp_mst em ON em."REF_EMP_ID" = pd."PERMISSIONS_REF_ID"
    WHERE pd."PERMISSIONS_REF_TYPE_ID" = ${userRef} AND pd."PERMISSIONS_CLASS_ID" IN (${he}, ${hm}) AND pd."OA_BRAND_ID" = ${brand}
      AND em."OA_BRAND_ID" = ${brand} AND em."IS_DELETED" = 0
    ORDER BY em."EMP_ID"`;
  return rows.map((r) => ({ value: Number(r.value), label: r.label || `Employee #${r.value}` })).sort((a, b) => a.label.localeCompare(b.label));
}

async function formOptions(subject: RequestSubject, brand: number): Promise<EmpFormOptions> {
  const byType = (typeId: number) => getMasterOptionsByType(typeId).then((list) => list.map((o) => ({ value: o.value, label: o.label })));
  const byCode = (code: string) => getMasterOptionsByTypeCode(code).then((list) => list.map((o) => ({ value: o.value, label: o.label })));
  const all = await getMasterId('ESALL');
  const [titles, countryCodes, statuses, genders, maritalStatuses, castes, races, ethnicities, bloodGroups, managers, hrExecutives,
    taxAllowanceTypes, careerStreams] = await Promise.all([
    byCode('SLTT'), byCode('CTCD'), byType(190), byType(133), byType(134), byType(135), byType(136), byCode('ETHN'), byType(281),
    managerOptions(subject), hrExecutiveOptions(brand), byCode('TAXALWTYP'), byCode('CARSTR'),
  ]);
  return {
    titles, countryCodes, statuses: statuses.filter((o) => o.value !== all), genders, maritalStatuses, castes, races, ethnicities,
    bloodGroups, managers, hrExecutives, taxAllowanceTypes, careerStreams,
  };
}

async function isIndiaBrand(brand: number): Promise<boolean> {
  const [india, b] = await Promise.all([getMasterId('IN'), prisma.oa_brands.findFirst({ where: { OA_BRAND_ID: brand }, select: { country: true } })]);
  return !!india && b?.country === india;
}

// ------------------------------------------------------------------ validation

const str = (max = 250) => z.preprocess((v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v)), z.string().max(max));
const flag = z.preprocess((v) => v === true || v === 1 || v === '1', z.boolean());
const bodySchema = z.object({
  EMP_NBR: str(100), title: str(), EMP_NAME: str(), cntctMddlNm: str(), cntctLstNm: str(), known_as: str(100), EMP_INITIALS: str(),
  email: str(), COUNTRY_CODE: str(), phone: str(), dob: str(), cntctSmoker: flag, EmployementStatus: str(), cntctGenderId: str(),
  marritalStatusId: str(), marriage_date: str(), maiden_name: str(100), castId: str(), raseId: str(), ethinicity: str(), bloodgrp: str(),
  isManager: flag, managerId: str(), hrExecutiveId: str(), taxAllowType: str(), ext_ref_emp_no: str(50), tax_ref_no: str(50),
  IS_DISABLE: flag, ni_table: str(10), EMP_SSN_NBR: str(), EMP_SIN_NBR: str(), EMP_PAN_NBR: str(), EMP_SKYPE_ID: str(),
  EMP_DRI_LICE_NBR: str(), EMP_DRI_LICE_EXP_DATE: str(), careerStream: str(), EMP_MILITARY_SERVICE: flag, IS_DIRECTOR: flag,
  IS_BUSINESS_OWNER: flag, IS_PSC: flag, IS_SHAREHOLDER: flag,
});

const LETTERS = /^[a-z ]+$/i;
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);

/**
 * CI setFormValidationRules (+ option membership, uniqueness, the column sizes). On edit, a value the record
 * already holds stays valid even if it has left its option list, and `locked` fields (copied from the record
 * for normal users) are not checked at all — the user could not fix them.
 */
async function validate(
  v: EmpValues, options: EmpFormOptions, brand: number,
  existing: { id: number; values: EmpValues; locked: readonly (keyof EmpValues)[] } | null,
) {
  const errors: Record<string, string[]> = {};
  const empId = existing?.id ?? null;
  const fail = (field: keyof EmpValues, message: string) => !existing?.locked.includes(field) && (errors[field] ??= [message]);
  const required = (field: keyof EmpValues, label: string) => !s(v[field]) && fail(field, `The ${label} field is required.`);
  const oneOf = (field: keyof EmpValues, label: string, list: IdLabel[]) =>
    s(v[field]) && v[field] !== existing?.values[field] && !list.some((o) => String(o.value) === s(v[field])) && fail(field, `Select a valid ${label}.`);

  required('EMP_NBR', 'Employee Code');
  if (v.EMP_NBR.length > 15) fail('EMP_NBR', 'The Employee Code field cannot exceed 15 characters.');
  required('title', 'Title');
  oneOf('title', 'Title', options.titles);
  required('EMP_NAME', 'First Name');
  if (v.EMP_NAME && !LETTERS.test(v.EMP_NAME)) fail('EMP_NAME', 'The First Name field may only contain alphabetical characters.');
  if (v.cntctMddlNm && !LETTERS.test(v.cntctMddlNm)) fail('cntctMddlNm', 'The Middle Name field may only contain alphabetical characters.');
  required('cntctLstNm', 'Last Name');
  if (v.cntctLstNm && !LETTERS.test(v.cntctLstNm)) fail('cntctLstNm', 'The Last Name field may only contain alphabetical characters.');
  required('EMP_INITIALS', 'Employee Initials');
  if (v.EMP_INITIALS.length > 10) fail('EMP_INITIALS', 'The Employee Initials field cannot exceed 10 characters.');
  required('email', 'Email');
  if (v.email && (!z.email().safeParse(v.email).success || v.email.length > 100)) fail('email', 'The Email field must contain a valid email address.');
  required('phone', 'Phone Number');
  if (v.phone && !/^\d{6,15}$/.test(v.phone)) fail('phone', 'The Phone Number field must be 6 to 15 digits.');
  oneOf('COUNTRY_CODE', 'Country Code', options.countryCodes);
  required('dob', 'Date Of Birth');
  if (v.dob && (!isDate(v.dob) || v.dob >= new Date().toISOString().slice(0, 10))) fail('dob', 'Enter a valid date of birth (before today).');
  if (v.marriage_date && !isDate(v.marriage_date)) fail('marriage_date', 'Invalid Date Format');
  if (v.EMP_DRI_LICE_EXP_DATE && !isDate(v.EMP_DRI_LICE_EXP_DATE)) fail('EMP_DRI_LICE_EXP_DATE', 'Invalid Date Format');
  if (v.EMP_SSN_NBR && !/^\d{1,12}$/.test(v.EMP_SSN_NBR)) fail('EMP_SSN_NBR', 'The SSN Number field must be up to 12 digits.');
  if (v.EMP_SIN_NBR.length > 15) fail('EMP_SIN_NBR', 'The SIN Number field cannot exceed 15 characters.');
  if (v.EMP_PAN_NBR && !/^[a-z0-9]{1,10}$/i.test(v.EMP_PAN_NBR)) fail('EMP_PAN_NBR', 'The PAN Number field may only contain up to 10 letters and digits.');
  if (v.EMP_DRI_LICE_NBR && (v.EMP_DRI_LICE_NBR.length > 16 || !isValidDrivingLicence(v.EMP_DRI_LICE_NBR))) {
    fail('EMP_DRI_LICE_NBR', 'Only Allowed Alpha Numeric and Slashes');
  }
  oneOf('EmployementStatus', 'Employee Status', options.statuses);
  oneOf('cntctGenderId', 'Gender', options.genders);
  oneOf('marritalStatusId', 'Marital Status', options.maritalStatuses);
  oneOf('castId', 'Caste', options.castes);
  oneOf('raseId', 'Race', options.races);
  oneOf('ethinicity', 'Ethnicity', options.ethnicities);
  oneOf('bloodgrp', 'Blood Group', options.bloodGroups);
  oneOf('taxAllowType', 'Tax Allowance Type', options.taxAllowanceTypes);
  oneOf('careerStream', 'Career Stream', options.careerStreams);
  oneOf('managerId', 'Manager', options.managers);
  oneOf('hrExecutiveId', 'HR Executive', options.hrExecutives);
  if (empId && v.managerId === String(empId)) fail('managerId', 'An employee cannot be their own manager.');

  if (v.EMP_NBR && v.EMP_NBR !== existing?.values.EMP_NBR) {
    const [dup] = await prisma.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM emp_mst
      WHERE "EMP_NBR" = ${v.EMP_NBR} AND "OA_BRAND_ID" = ${brand} AND "IS_DELETED" = 0 AND "EMP_ID" <> ${empId ?? -1}`;
    if (dup.n) fail('EMP_NBR', 'The Employee Code is already used by another employee.');
  }
  if (Object.keys(errors).length) throw new ValidationError('Validation failed.', errors);
}

const num = (v: string) => (v === '' ? null : Number(v));
const day = (v: string) => (v === '' ? null : v);

/** CI REF_EMP_NBR: letter runs followed by digits keep the digits ("GS24100012" → 24100012). */
function refEmpNbr(code: string): number | null {
  const digits = code.replace(/([a-zA-Z]+)(\d+)/g, '$2');
  if (!/^\d{1,9}$/.test(digits)) return null;
  return Number(digits);
}

function toColumns(v: EmpValues): Omit<Record<Column, unknown>, 'OA_CNTCT_EML_ID' | 'OA_CNTCT_PHONE_ID'> {
  return {
    EMP_NBR: v.EMP_NBR, REF_EMP_NBR: refEmpNbr(v.EMP_NBR), TITLE: num(v.title), EMP_NAME: v.EMP_NAME, EMP_MIDDLE_NM: v.cntctMddlNm || null,
    EMPLST_NM: v.cntctLstNm, KNOWN_AS: v.known_as || null, EMP_INITIALS: v.EMP_INITIALS, COUNTRY_CODE: v.COUNTRY_CODE,
    DOB: day(v.dob), IS_SMOKER: v.cntctSmoker ? 1 : 0, EMP_STATUS_ID: num(v.EmployementStatus), GENDER_ID: num(v.cntctGenderId),
    MARITAL_STATUS_ID: num(v.marritalStatusId), MARRIAGE_DATE: day(v.marriage_date), MAIDEN_NAME: v.maiden_name || null,
    CAST_ID: num(v.castId), RAISE_ID: num(v.raseId), ETHINICITY_ID: num(v.ethinicity), BLOOD_GRP: v.bloodgrp || null,
    IS_MANAGER: v.isManager ? '1' : '0', MANAGER_ID: num(v.managerId), HR_EXECUTIVE_ID: num(v.hrExecutiveId),
    TAX_ALLOWANCE_TYPE_ID: num(v.taxAllowType), EXT_REF_EMP_NO: v.ext_ref_emp_no || null, TAX_REF_NO: v.tax_ref_no || null,
    IS_DISABLE: v.IS_DISABLE ? 1 : 0, NI_TABLE: v.ni_table || null, EMP_SSN_NBR: v.EMP_SSN_NBR || null, EMP_SIN_NBR: v.EMP_SIN_NBR || null,
    EMP_PAN_NBR: v.EMP_PAN_NBR || null, SKYPE_ID: v.EMP_SKYPE_ID || null, EMP_DRI_LICE_NBR: v.EMP_DRI_LICE_NBR || null,
    EMP_DRI_LICE_EXP_DATE: day(v.EMP_DRI_LICE_EXP_DATE), CAREERSTREAM_ID: num(v.careerStream),
    EMP_MILITARY_SERVICE: v.EMP_MILITARY_SERVICE ? '1' : '0', IS_DIRECTOR: v.IS_DIRECTOR ? 1 : 0,
    IS_BUSINESS_OWNER: v.IS_BUSINESS_OWNER ? 1 : 0, IS_PSC: v.IS_PSC ? 1 : 0, IS_SHAREHOLDER: v.IS_SHAREHOLDER ? 1 : 0,
  };
}

const cast = (column: string) => `::${COLUMN_TYPES[column as Column]}`;

type Tx = Prisma.TransactionClient;

/** The e-mail / phone link values for emp_mst: through the contact tables, or raw for an employee without a login. */
async function contactValues(tx: Tx, owner: ContactOwner | null, email: string, phone: string, country: string) {
  if (!owner) return { OA_CNTCT_EML_ID: email || null, OA_CNTCT_PHONE_ID: phone || null };
  return {
    OA_CNTCT_EML_ID: email ? String(await linkEmail(tx, owner, email)) : null,
    OA_CNTCT_PHONE_ID: phone ? String(await linkPhone(tx, owner, phone, country)) : null,
  };
}

/** emp_reporting: the employee's line-manager row follows MANAGER_ID (CI update). */
async function syncLineManager(tx: Tx, empId: number, managerId: number | null, brand: number, oaId: number | null, actor: number) {
  if (!managerId) return;
  const [lineManager, direct] = await Promise.all([getMasterId('EMLM'), getMasterId('DiRC')]);
  const updated = await tx.$executeRaw`
    UPDATE emp_reporting SET "MANAGER_ID" = ${managerId}, "REPORTING_MODE_ID" = ${direct}, "UPDATED_BY" = ${actor}, "UPDATED_ON" = now()
    WHERE "EMP_ID" = ${empId} AND "MANAGER_TYPE_ID" = ${lineManager} AND COALESCE("IS_DELETED", 0) = 0`;
  if (updated) return;
  await assertInsertSafe('emp_reporting', 'EMP_REPORTING_ID');
  await tx.$executeRaw`
    INSERT INTO emp_reporting ("EMP_ID", "MANAGER_ID", "MANAGER_TYPE_ID", "REPORTING_MODE_ID", "OA_ID", "OA_BRAND_ID", "USER_ID", "CREATED_BY", "CREATED_ON")
    VALUES (${empId}, ${managerId}, ${lineManager}, ${direct}, ${oaId}, ${brand}, ${actor}, ${actor}, now())`;
}

export const empMstService = {
  /** CI initForm data: dropdowns, Caste / Race for India brands, the user's read-only fields. */
  async form(subject: RequestSubject): Promise<EmpFormModel> {
    const can = await Promise.all((['all', 'team'] as EmpScreen[]).map((sc) => menuPolicy(EMP_SCREENS[sc].menu).check(subject, 'list')));
    if (!can.some(Boolean)) throw new ForbiddenError();
    const brand = activeBrand(subject);
    const [options, india] = await Promise.all([formOptions(subject, brand), isIndiaBrand(brand)]);
    return { options, showCasteRace: india, restricted: subject.adminLevel === 0 };
  },

  async get(subject: RequestSubject, rawId: string): Promise<EmpValues> {
    return toValues(await findAccessible(subject, parseId(rawId), 'read'));
  },

  /** CI insert(): admins with the Employee Manager create grant. */
  async create(subject: RequestSubject, body: unknown): Promise<{ id: number; message: string }> {
    if (subject.adminLevel === 0 || !(await menuPolicy(EMP_SCREENS.all.menu).check(subject, 'create'))) throw new ForbiddenError();
    const brand = activeBrand(subject);
    const v = bodySchema.parse(body) as EmpValues;
    if (!v.EmployementStatus) v.EmployementStatus = String((await getMasterId('EMSC')) ?? '');
    const options = await formOptions(subject, brand);
    await validate(v, options, brand, null);
    const oaId = await brandOrgId(brand, subject.oaId);

    await assertInsertSafe('emp_mst', 'EMP_ID');
    const id = await prisma.$transaction(async (tx) => {
      const data: Record<string, unknown> = { ...toColumns(v), ...(await contactValues(tx, null, v.email, v.phone, v.COUNTRY_CODE)) };
      const names = Object.keys(data);
      const params = names.map((n) => data[n]);
      params.push(oaId, brand, subject.userId);
      const p = params.length;
      const [row] = await tx.$queryRawUnsafe<Array<{ id: number }>>(
        `INSERT INTO emp_mst (${names.map((n) => `"${n}"`).join(', ')}, "EMP_OTHER_ID", "JOB_TITLE_ID", "EMP_GRADE_ID", "TERMINATION_ID",
           "TERMINATION_DATE", "IS_DELETED", "OA_ID", "OA_BRAND_ID", "USER_ID", "CREATED_BY", "CREATED_ON")
         VALUES (${names.map((n, i) => `$${i + 1}${cast(n)}`).join(', ')}, '', 0, 0, 0, DATE '1970-01-01', 0,
           $${p - 2}::integer, $${p - 1}::integer, $${p}::integer, $${p}::integer, now())
         RETURNING "EMP_ID" AS id`,
        ...params,
      );
      await syncLineManager(tx, row.id, num(v.managerId), brand, oaId, subject.userId);
      return row.id;
    }, { timeout: 30000 });
    return { id, message: 'Successfully Added Employee Master' };
  },

  /** CI update($id). */
  async update(subject: RequestSubject, rawId: string, body: unknown): Promise<{ id: number; message: string }> {
    const empId = parseId(rawId);
    const row = await findAccessible(subject, empId, 'update');
    const existing = toValues(row);
    const posted = bodySchema.parse(body) as EmpValues;
    // Read-only for normal users (CI readonly inputs) and status for everyone on edit (CI disabled select).
    const v: EmpValues = { ...posted, EmployementStatus: existing.EmployementStatus };
    if (subject.adminLevel === 0) for (const key of USER_READ_ONLY) (v as Record<string, unknown>)[key] = existing[key];
    const brand = row.OA_BRAND_ID;
    await validate(v, await formOptions(subject, brand), brand, { id: empId, values: existing, locked: subject.adminLevel === 0 ? USER_READ_ONLY : [] });

    await prisma.$transaction(async (tx) => {
      const owner: ContactOwner | null = row.REF_EMP_ID
        ? { userId: row.REF_EMP_ID, empId, oaId: row.OA_ID, oaBrandId: brand, actorId: subject.userId }
        : null;
      const data: Record<string, unknown> = toColumns(v);
      if (v.email !== existing.email) Object.assign(data, { OA_CNTCT_EML_ID: (await contactValues(tx, owner, v.email, '', '')).OA_CNTCT_EML_ID });
      if (v.phone !== existing.phone || v.COUNTRY_CODE !== existing.COUNTRY_CODE) {
        Object.assign(data, { OA_CNTCT_PHONE_ID: (await contactValues(tx, owner, '', v.phone, v.COUNTRY_CODE)).OA_CNTCT_PHONE_ID });
      }
      if (v.EMP_NBR === existing.EMP_NBR) delete data.REF_EMP_NBR; // CI recomputed it and dropped the biometric prefix
      const names = Object.keys(data);
      const params = names.map((n) => data[n]);
      params.push(subject.userId, empId);
      await tx.$executeRawUnsafe(
        `UPDATE emp_mst SET ${names.map((n, i) => `"${n}" = $${i + 1}${cast(n)}`).join(', ')},
           "UPDATED_BY" = $${params.length - 1}::integer, "UPDATED_ON" = now()
         WHERE "EMP_ID" = $${params.length}::integer`,
        ...params,
      );
      if (row.REF_EMP_ID && (v.EMP_NAME !== existing.EMP_NAME || v.cntctLstNm !== existing.cntctLstNm)) {
        await tx.$executeRaw`
          UPDATE contact_mst SET "CNTCT_FRST_NM" = ${v.EMP_NAME.slice(0, 40)}, "CNTCT_LST_NM" = ${v.cntctLstNm.slice(0, 40)},
            "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now()
          WHERE "REF_EMP_ID" = ${row.REF_EMP_ID}`;
      }
      if (v.managerId !== existing.managerId) await syncLineManager(tx, empId, num(v.managerId), brand, row.OA_ID, subject.userId);
    }, { timeout: 30000 });
    return { id: empId, message: 'Successfully Updated Employee Manager' };
  },

  /** CI delete($id): soft delete, admins only. */
  async remove(subject: RequestSubject, rawId: string): Promise<{ id: number }> {
    if (subject.adminLevel === 0) throw new ForbiddenError('Only administrators can delete employees.');
    const empId = parseId(rawId);
    await findAccessible(subject, empId, 'delete');
    await prisma.$executeRaw`
      UPDATE emp_mst SET "IS_DELETED" = 1, "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now() WHERE "EMP_ID" = ${empId}`;
    return { id: empId };
  },
};
