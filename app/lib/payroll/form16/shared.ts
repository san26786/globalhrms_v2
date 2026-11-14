import type { RequestSubject } from '@/lib/auth/getSubject';
import { SqlBuilder } from '@/lib/employeeMngt/empList';
import { fullName, scopeSql, type Tx } from '@/lib/employeeMngt/hub/hubEngine';
import { mastersByCode } from '@/lib/employeeMngt/hub/hubOptions';
import { ForbiddenError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { menuPolicy } from '@/lib/resource/policies';
import type { ResourceAction, ResourcePermissions } from '@/lib/resource/types';
import type { IdLabel } from '@/lib/systmMngt/shared';

/**
 * CI form16/* (group P5a) — what the four Form 16 controllers share.
 *
 * Menu: only form16/form16 ("Form 16", menu 759 under Payroll) exists; CI reached form16_quarters,
 * form16_quarter_settings and form16_settings from it (session permission_id = that menu), so its grant governs all four.
 * Masters (CI getAllIndMstDetailsByTypeCode): quarters SYSQUA, OLTAS statuses SYSOLT, countries HTGHN; periods
 * (CI period_mst_vw PERIOD_TYPE_ID 862 / 861): assessment years OPTAY and financial years OPTFY.
 */
export const FORM16_MENU = 'form16/form16';
export const form16Policy = menuPolicy(FORM16_MENU);

export const QUARTER_TYPE = 'SYSQUA';
export const OLTAS_TYPE = 'SYSOLT';
export const COUNTRY_TYPE = 'HTGHN';

export async function form16Allowed(subject: RequestSubject, action: ResourceAction): Promise<boolean> {
  return form16Policy.check(subject, action);
}

export async function requireForm16(subject: RequestSubject, action: ResourceAction): Promise<void> {
  if (!(await form16Allowed(subject, action))) throw new ForbiddenError();
}

export async function form16Permissions(subject: RequestSubject): Promise<ResourcePermissions> {
  const [create, update, del] = await Promise.all([form16Allowed(subject, 'create'), form16Allowed(subject, 'update'), form16Allowed(subject, 'delete')]);
  return { create, update, delete: del };
}

const dmy = (iso: string | null) => (iso ? iso.split('-').reverse().join('-') : '');

/**
 * The brand's periods of one type (OPTAY assessment years / OPTFY financial years), newest first. Several share a
 * name in the live data, so the dates are part of the label. CI listed every brand's periods of the type.
 */
export async function periodOptions(typeCode: 'OPTAY' | 'OPTFY', brand: number | null): Promise<IdLabel[]> {
  const rows = await prisma.$queryRaw<Array<{ value: number; name: string | null; start: string | null; end: string | null }>>`
    SELECT p."PERIOD_ID" AS value, p."FISCAL_PERIOD_DESC" AS name,
      to_char(p."PERIOD_START_DATE", 'YYYY-MM-DD') AS start, to_char(p."PERIOD_END_DATE", 'YYYY-MM-DD') AS "end"
    FROM period_mst p
    WHERE p."PERIOD_TYPE_ID" = (SELECT im."MSTR_ID" FROM independent_mst im WHERE im."MSTR_CD" = ${typeCode} ORDER BY im."MSTR_ID" LIMIT 1)
      AND p."IS_DELETED" = 0 AND p."OA_BRAND_ID" = ${brand ?? -1}
    ORDER BY p."PERIOD_START_DATE" DESC NULLS LAST, p."PERIOD_ID" DESC`;
  return rows.map((r) => {
    const name = r.name?.replace(/\s+/g, ' ').trim() || `Period #${r.value}`;
    return { value: Number(r.value), label: r.start && r.end ? `${name} (${dmy(r.start)} – ${dmy(r.end)})` : name };
  });
}

export interface PeriodInfo {
  id: number;
  name: string;
  /** YYYY-MM-DD */
  start: string | null;
  end: string | null;
  brand: number | null;
  type: string | null;
}

/** A period (any brand) with its type code — to check a choice and to print it. */
export async function periodInfo(id: number | null, db: Tx = prisma): Promise<PeriodInfo | null> {
  if (!id) return null;
  const [r] = await db.$queryRaw<Array<{ id: number; name: string | null; start: string | null; end: string | null; brand: number | null; type: string | null }>>`
    SELECT p."PERIOD_ID" AS id, p."FISCAL_PERIOD_DESC" AS name, to_char(p."PERIOD_START_DATE", 'YYYY-MM-DD') AS start,
      to_char(p."PERIOD_END_DATE", 'YYYY-MM-DD') AS "end", p."OA_BRAND_ID" AS brand,
      (SELECT im."MSTR_CD" FROM independent_mst im WHERE im."MSTR_ID" = p."PERIOD_TYPE_ID" LIMIT 1) AS type
    FROM period_mst p WHERE p."PERIOD_ID" = ${id} AND p."IS_DELETED" = 0 LIMIT 1`;
  return r ? { id: Number(r.id), name: r.name?.replace(/\s+/g, ' ').trim() ?? '', start: r.start, end: r.end, brand: r.brand === null ? null : Number(r.brand), type: r.type } : null;
}

/** CI getAllIndMstDetailsByTypeCode('SYSQUA') — the quarters (Q1 … Q4). */
export const quarterOptions = () => mastersByCode(QUARTER_TYPE);
/** CI getAllIndMstDetailsByTypeCode('SYSOLT') — OLTAS matching statuses. */
export const oltasOptions = () => mastersByCode(OLTAS_TYPE);
/** CI getAllIndMstDetailsByTypeCode(HTGHN) — countries. */
export const countryOptions = () => mastersByCode(COUNTRY_TYPE);

/** The row of a Form 16 (with its employee) if it is live and in the caller's scope (CI getTableDtl on the employee). */
export async function form16InScope(subject: RequestSubject, id: number, db: Tx = prisma): Promise<{ id: number; empId: number; brand: number; oaId: number | null; label: string } | null> {
  const sql = new SqlBuilder();
  const scope = await scopeSql(subject, sql);
  const [r] = await db.$queryRawUnsafe<Array<{ id: number; emp: number; brand: number; oa: number | null; name: string; code: string | null }>>(
    `SELECT f."FORM16_ID" AS id, em."EMP_ID" AS emp, em."OA_BRAND_ID" AS brand, f."OA_ID" AS oa, ${fullName('em')} AS name, em."EMP_NBR" AS code
     FROM form16 f JOIN emp_mst em ON em."EMP_ID" = f."EMP_ID"
     WHERE f."FORM16_ID" = ${sql.p(id)}::int AND f."IS_DELETED" = 0 AND em."IS_DELETED" = 0 AND ${scope} LIMIT 1`,
    ...sql.params,
  );
  if (!r) return null;
  return { id: Number(r.id), empId: Number(r.emp), brand: Number(r.brand), oaId: r.oa === null ? null : Number(r.oa), label: form16Label(Number(r.id), r.name, r.code) };
}

export const form16Label = (id: number, name: string, code: string | null) => `${name || 'Employee'}${code ? ` (${code})` : ''} — Form-16 #${id}`;

/** The Form 16s the caller may pick (a quarter added from the quarters list): live ones in scope, newest first. */
export async function form16Options(subject: RequestSubject): Promise<IdLabel[]> {
  const sql = new SqlBuilder();
  const scope = await scopeSql(subject, sql);
  const rows = await prisma.$queryRawUnsafe<Array<{ id: number; name: string; code: string | null }>>(
    `SELECT f."FORM16_ID" AS id, ${fullName('em')} AS name, em."EMP_NBR" AS code
     FROM form16 f JOIN emp_mst em ON em."EMP_ID" = f."EMP_ID"
     WHERE f."IS_DELETED" = 0 AND em."IS_DELETED" = 0 AND ${scope}
     ORDER BY f."FORM16_ID" DESC LIMIT 500`,
    ...sql.params,
  );
  return rows.map((r) => ({ value: Number(r.id), label: form16Label(Number(r.id), r.name, r.code) }));
}

/** What CI's form16.js filled in when an employee was picked (getEmpSal, getEmpAddress / T / Th, getPostalCode, getcity, getcountry). */
export interface EmployeeForm16Details {
  salary: string;
  address1: string;
  address2: string;
  address3: string;
  postalCode: string;
  city: string;
  /** Country master id (CI put the country name into the id-valued select, which then matched nothing). */
  country: string;
  /** The employee has no address on file (CI filled "0" into every field). */
  noAddress: boolean;
}

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());

/**
 * CI getSalarybyEmpId (job_mst.EMP_GROSS_SALARY) and getAddressbyEmpId (the employee's contact address: street name,
 * locality, area, postcode, city, country of address_mst_vw). CI took the first job row and the first address row in
 * whatever order MySQL returned them; here the latest live job and the primary (else current, else latest) address.
 */
export async function employeeForm16Details(empId: number): Promise<EmployeeForm16Details> {
  const [job] = await prisma.$queryRaw<Array<{ gross: number | null }>>`
    SELECT j."EMP_GROSS_SALARY" AS gross FROM job_mst j WHERE j."EMP_ID" = ${empId} AND j."IS_DELETED" = 0 ORDER BY j."JOB_ID" DESC LIMIT 1`;
  const [a] = await prisma.$queryRaw<Array<{ street: string | null; locality: string | null; area: string | null; postcode: string | null; city: string | null; country: number | null }>>`
    SELECT
      (SELECT st."STREET_NAME" FROM street_mst st WHERE st."STREET_ID"::text = btrim(am."ADDRESS_LINE_1") LIMIT 1) AS street,
      (SELECT st."LOCALITY" FROM street_mst st WHERE st."STREET_ID"::text = btrim(am."ADDRESS_LINE_2") LIMIT 1) AS locality,
      (SELECT st."AREA" FROM street_mst st WHERE st."STREET_ID"::text = btrim(am."ADDRESS_LINE_3") LIMIT 1) AS area,
      (SELECT pc."POSTCODE"::text FROM postcode_mst pc WHERE pc."POSTCODE_ID" = am."POSTCODE" LIMIT 1) AS postcode,
      (SELECT l."LOC_NAME" FROM location_mst l WHERE l."LOC_ID"::text = btrim(am."CITY") LIMIT 1) AS city,
      am."COUNTRY" AS country
    FROM emp_mst em
    JOIN contact_address t ON t."IS_DELETED" = 0
      AND COALESCE((SELECT cm."REF_EMP_ID" FROM contact_mst cm WHERE cm."CNTCT_ID" = t."CNTCT_ID"), t."USER_ID") = em."REF_EMP_ID"
    JOIN address_mst am ON am."ADDRESS_ID" = t."ADD_ID"
    WHERE em."EMP_ID" = ${empId}
    ORDER BY (t."IS_PRIMARY_ADD" ~ '^\\s*0*1(\\.0*)?\\s*$') DESC, (t."IS_CURRENT_ADD" ~ '^\\s*0*1(\\.0*)?\\s*$') DESC, t."CNTCT_ADD_ID" DESC
    LIMIT 1`;
  return {
    salary: job?.gross === null || job?.gross === undefined ? '0' : String(job.gross),
    address1: s(a?.street),
    address2: s(a?.locality),
    address3: s(a?.area),
    postalCode: s(a?.postcode).replace(/\s+/g, ''),
    city: s(a?.city),
    country: a?.country ? String(a.country) : '',
    noAddress: !a,
  };
}
