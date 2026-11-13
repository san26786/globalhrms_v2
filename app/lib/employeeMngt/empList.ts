import type { RequestSubject } from '@/lib/auth/getSubject';
import { getMasterId, getMasterOptionsByType } from '@/lib/masters/masterService';
import { permissionRepository } from '@/lib/permission/permissionRepository';
import { prisma } from '@/lib/prisma';
import { columnSearchConditions } from '@/lib/resource/columnSearch';
import { parseListQuery } from '@/lib/resource/listQuery';
import { menuPolicy } from '@/lib/resource/policies';
import type { ListResult, ResourcePermissions } from '@/lib/resource/types';
import { authorize, type IdLabel } from '@/lib/systmMngt/shared';
import { EMP_SCREENS, type EmpFilterModel, type EmpRow, type EmpScreen } from './empTypes';

/**
 * CI employeeMngt/emp_mst::index() ("Employee Manager") and ::MyTeamEmployee() ("Team Employee
 * Manager"): the employee list with CI's filters — Employee Status (default Current; "Select All" = any
 * status), Department (the employee's latest job row) and Manager — paged, searchable and sortable.
 * Columns are those of CI's list view emp_manager_new_vw (prisma/sql/views/emp_manager_new_vw.sql),
 * computed here from the tables because the view does not exist in PostgreSQL.
 *
 * Scoping (CI getTableDtl + MyTeamEmployee): super admin every brand; brand admin the brand; a user —
 * Employee Manager: their own employee row; Team: the employees whose MANAGER_ID is them, or whose
 * HR_EXECUTIVE_ID is them when their permission class is HR Executive / HR Managerial Service (PCHE / PCHM).
 *
 * Behaviour changes: a user without an employee record sees nobody on Team (CI dropped the filter and
 * listed every brand's employees); "Select All" on Team lists every status (CI listed nothing) and on
 * Employee Manager keeps the Department / Manager filters (CI dropped them); every value is a query
 * parameter (CI concatenated the filters and search into the SQL).
 */

export class SqlBuilder {
  readonly params: unknown[] = [];
  p(value: unknown): string {
    this.params.push(value);
    return `$${this.params.length}`;
  }
}

/** Text column holding an id → the id, or NULL when it holds anything else. */
const asId = (expr: string) => `CASE WHEN ${expr} ~ '^\\s*-?[0-9]+\\s*$' THEN btrim(${expr})::bigint END`;
const masterName = (expr: string) => `(SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = ${expr} ORDER BY im."MSTR_ID" LIMIT 1)`;
const fullName = (alias: string) =>
  `btrim(regexp_replace(COALESCE(${alias}."EMP_NAME", '') || ' ' || COALESCE(${alias}."EMP_MIDDLE_NM", '') || ' ' || COALESCE(${alias}."EMPLST_NM", ''), '\\s+', ' ', 'g'))`;
const latestJob = (column: string) => `(SELECT j."${column}" FROM job_mst j WHERE j."EMP_ID" = em."EMP_ID" ORDER BY j."JOB_ID" DESC LIMIT 1)`;

/** The employee's e-mail: through the contact tables (CI view), or the raw address some rows hold. */
export const EMAIL_EXPR = `COALESCE(
  (SELECT ea."EMAIL_ADD" FROM email_address_mst ea WHERE ea."EMAIL_ADD_ID" = (
     SELECT ce."EMAIL_ADD_ID" FROM contact_emails ce WHERE ce."CNTCT_EML_ID" = (
       SELECT ${asId('oce."CNTCT_EML_ID"')} FROM oa_contact_emails oce WHERE oce."OA_CNTCT_EML_ID" = ${asId('em."OA_CNTCT_EML_ID"')} LIMIT 1)
     LIMIT 1) LIMIT 1),
  CASE WHEN em."OA_CNTCT_EML_ID" LIKE '%@%' THEN em."OA_CNTCT_EML_ID" END)`;

/** The employee's phone number: through the contact tables, or a raw number some rows hold. */
export const PHONE_EXPR = `COALESCE(
  (SELECT pn."PHONE_NBR" FROM phone_nbr_mst pn WHERE pn."PHONE_NBR_ID" = (
     SELECT cp."PHONE_NBR_ID" FROM contact_phones cp WHERE cp."CNTCT_PHONE_ID" = (
       SELECT ${asId('ocp."CNTCT_PHONE_ID"')} FROM oa_contact_phones ocp WHERE ocp."OA_CNTCT_PHONE_ID" = ${asId('em."OA_CNTCT_PHONE_ID"')} LIMIT 1)
     LIMIT 1) LIMIT 1),
  CASE WHEN em."OA_CNTCT_PHONE_ID" ~ '^[0-9]{6,}$' AND length(em."OA_CNTCT_PHONE_ID") >= 10 THEN em."OA_CNTCT_PHONE_ID" END)`;

const LIST_COLUMNS = `
  em."EMP_ID" AS id, em."EMP_NBR", ${masterName('em."TITLE"')} AS "TITLE_NM",
  em."EMP_NAME", em."EMP_MIDDLE_NM", em."EMPLST_NM", ${fullName('em')} AS "EMP_FULL_NAME", em."EMP_INITIALS", em."KNOWN_AS",
  CASE WHEN em."IS_MANAGER" ~ '^\\s*0*1(\\.0*)?\\s*$' THEN 'Yes' ELSE 'No' END AS "IS_MANAGER",
  em."MANAGER_ID", (SELECT ${fullName('m')} FROM emp_mst m WHERE m."EMP_ID" = em."MANAGER_ID" LIMIT 1) AS "MANAGER",
  em."HR_EXECUTIVE_ID",
  ${latestJob('DEPARTMENT_ID')} AS "DEPARTMENTID", ${masterName(latestJob('DEPARTMENT_ID'))} AS "DEPARTMENT",
  em."EMP_STATUS_ID", ${masterName('em."EMP_STATUS_ID"')} AS "EMP_STATUS",
  ${masterName('em."GENDER_ID"')} AS "GENDER", to_char(em."DOB", 'YYYY-MM-DD') AS "DOB",
  ${EMAIL_EXPR} AS "EMAIL_ADD",
  NULLIF(btrim(COALESCE(${masterName(asId('em."COUNTRY_CODE"'))}, '') || ' ' || COALESCE(${PHONE_EXPR}, '')), '') AS "FULL_PHONE_NBR",
  em."OA_BRAND_ID", (SELECT b."OA_BRAND_CD" FROM oa_brands b WHERE b."OA_BRAND_ID" = em."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_CD"`;

const SORTS: Record<string, string> = {
  EMP_NBR: 'v."EMP_NBR"',
  EMP_NAME: 'v."EMP_NAME"',
  EMPLST_NM: 'v."EMPLST_NM"',
  EMP_FULL_NAME: 'v."EMP_FULL_NAME"',
  DEPARTMENT: 'v."DEPARTMENT"',
  MANAGER: 'v."MANAGER"',
  EMP_STATUS: 'v."EMP_STATUS"',
  DOB: 'v."DOB"',
};

/** Row keys the list shows (and searches per column). */
const SEARCHABLE_COLUMNS = ['EMP_NBR', 'TITLE_NM', 'EMP_NAME', 'EMP_MIDDLE_NM', 'EMPLST_NM', 'EMP_FULL_NAME', 'EMP_INITIALS', 'IS_MANAGER', 'KNOWN_AS',
  'MANAGER', 'DOB', 'DEPARTMENT', 'GENDER', 'EMAIL_ADD', 'FULL_PHONE_NBR', 'EMP_STATUS', 'OA_BRAND_CD'];

const HR_CLASS_CODES = ['PCHE', 'PCHM'];

/** CI getEmpIdFromUserID(): the caller's own employee row in the active brand. */
export async function ownEmployeeId(subject: RequestSubject): Promise<number | null> {
  if (!subject.oaBrandId) return null;
  const rows = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT "EMP_ID" AS id FROM emp_mst
    WHERE "REF_EMP_ID" = ${subject.userId} AND "OA_BRAND_ID" = ${subject.oaBrandId} AND "IS_DELETED" = 0
    ORDER BY "EMP_ID" LIMIT 1`;
  return rows[0]?.id ?? null;
}

/** CI: permission class HR Executive / HR Managerial Service sees the employees it is HR executive of. */
async function isHrClass(subject: RequestSubject): Promise<boolean> {
  const classId = await permissionRepository.getPermissionsClassId(subject);
  if (!classId) return false;
  const ids = await Promise.all(HR_CLASS_CODES.map((c) => getMasterId(c)));
  return ids.includes(classId);
}

/** WHERE fragment (on emp_mst em) for the rows `subject` may see on `screen`. */
export async function scopeFor(subject: RequestSubject, screen: EmpScreen, sql: SqlBuilder): Promise<string> {
  if (subject.adminLevel === 2) return 'TRUE';
  const brand = sql.p(subject.oaBrandId ?? -1);
  if (subject.adminLevel === 1) return `em."OA_BRAND_ID" = ${brand}`;
  if (screen === 'all') return `em."OA_BRAND_ID" = ${brand} AND em."REF_EMP_ID" = ${sql.p(subject.userId)}`;
  const own = await ownEmployeeId(subject);
  if (!own) return 'FALSE';
  const column = (await isHrClass(subject)) ? 'HR_EXECUTIVE_ID' : 'MANAGER_ID';
  return `em."OA_BRAND_ID" = ${brand} AND em."${column}" = ${sql.p(own)}`;
}

async function screenPermissions(subject: RequestSubject, screen: EmpScreen): Promise<ResourcePermissions> {
  const policy = menuPolicy(EMP_SCREENS[screen].menu);
  const [create, update, del] = await Promise.all([policy.check(subject, 'create'), policy.check(subject, 'update'), policy.check(subject, 'delete')]);
  return {
    // CI offered the add form from Employee Manager only.
    create: screen === 'all' && subject.adminLevel !== 0 && create,
    update,
    // CI: delete for admins (the Team screen also offered it to managers — behaviour change).
    delete: subject.adminLevel !== 0 && del,
  };
}

const toInt = (raw: string | undefined) => {
  const n = Number(raw);
  return raw && Number.isInteger(n) && n > 0 ? n : null;
};

export const empListService = {
  async list(subject: RequestSubject, screen: EmpScreen, rawQuery: Record<string, string>): Promise<ListResult<EmpRow> & { permissions: ResourcePermissions }> {
    await authorize(subject, EMP_SCREENS[screen].menu, 'list');
    const query = parseListQuery(rawQuery);
    const sql = new SqlBuilder();
    const scope = await scopeFor(subject, screen, sql);

    const [current, all] = await Promise.all([getMasterId('EMSC'), getMasterId('ESALL')]);
    const status = rawQuery.status === undefined || rawQuery.status === '' ? current : toInt(rawQuery.status);
    const filters: string[] = [];
    if (status && status !== all) filters.push(`v."EMP_STATUS_ID" = ${sql.p(status)}`);
    const department = toInt(rawQuery.department);
    if (department) filters.push(`v."DEPARTMENTID" = ${sql.p(department)}`);
    const manager = toInt(rawQuery.manager);
    if (manager) filters.push(`v."MANAGER_ID" = ${sql.p(manager)}`);
    if (query.search) {
      const term = sql.p(`%${query.search}%`);
      filters.push(`(${['EMP_NBR', 'EMP_FULL_NAME', 'KNOWN_AS', 'EMP_INITIALS', 'EMAIL_ADD', 'DEPARTMENT', 'MANAGER', 'TITLE_NM']
        .map((c) => `v."${c}" ILIKE ${term}`).join(' OR ')})`);
    }
    // CI listview's per-column search boxes.
    filters.push(...columnSearchConditions(rawQuery, SEARCHABLE_COLUMNS, (v) => sql.p(v)));
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const sort = query.sort && SORTS[query.sort] ? `${SORTS[query.sort]} ${query.dir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST, v.id DESC` : 'v.id DESC';
    const from = `(SELECT ${LIST_COLUMNS} FROM emp_mst em WHERE em."IS_DELETED" = 0 AND ${scope}) v ${where}`;

    const [rows, count, permissions] = await Promise.all([
      prisma.$queryRawUnsafe<Array<EmpRow & Record<string, unknown>>>(
        `SELECT * FROM ${from} ORDER BY ${sort} LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`,
        ...sql.params,
      ),
      prisma.$queryRawUnsafe<Array<{ n: number }>>(`SELECT count(*)::int AS n FROM ${from}`, ...sql.params),
      screenPermissions(subject, screen),
    ]);
    return {
      rows: rows.map((r) => ({
        id: Number(r.id), EMP_NBR: r.EMP_NBR, TITLE_NM: r.TITLE_NM, EMP_NAME: r.EMP_NAME, EMP_MIDDLE_NM: r.EMP_MIDDLE_NM,
        EMPLST_NM: r.EMPLST_NM, EMP_FULL_NAME: r.EMP_FULL_NAME, EMP_INITIALS: r.EMP_INITIALS, KNOWN_AS: r.KNOWN_AS,
        IS_MANAGER: r.IS_MANAGER, MANAGER: r.MANAGER, DEPARTMENT: r.DEPARTMENT, EMP_STATUS: r.EMP_STATUS, GENDER: r.GENDER,
        DOB: r.DOB, EMAIL_ADD: r.EMAIL_ADD, FULL_PHONE_NBR: r.FULL_PHONE_NBR, OA_BRAND_CD: r.OA_BRAND_CD,
      })),
      total: count[0]?.n ?? 0,
      page: query.page,
      limit: query.limit,
      permissions,
    };
  },

  /** CI customFields: Employee Status (all), Department (the brand's), Manager (admins). */
  async filters(subject: RequestSubject, screen: EmpScreen): Promise<EmpFilterModel> {
    await authorize(subject, EMP_SCREENS[screen].menu, 'list');
    const brand = subject.oaBrandId ?? -1;
    const [statuses, departments, current, all] = await Promise.all([
      getMasterOptionsByType(190),
      departmentOptions(brand),
      getMasterId('EMSC'),
      getMasterId('ESALL'),
    ]);
    return {
      statuses: statuses.map((s) => ({ value: s.value, label: s.label })),
      allStatusId: all,
      currentStatusId: current,
      departments,
      managers: subject.adminLevel !== 0 ? await managerOptions(subject) : null,
      showFilters: screen === 'team' || subject.adminLevel !== 0,
    };
  },
};

/** CI getAllIndMstDetailsByTypeCode('HTCPP', brand): the brand's departments. */
export async function departmentOptions(brand: number): Promise<IdLabel[]> {
  const rows = await prisma.$queryRaw<Array<{ value: number; label: string }>>`
    SELECT DISTINCT ON (im."MSTR_NM") im."MSTR_ID" AS value, im."MSTR_NM" AS label
    FROM independent_mst im JOIN common_type t ON t."TYP_ID" = im."TYP_ID"
    WHERE t."TYP_CD" = 'HTCPP' AND im."OA_BRAND_ID" = ${brand} AND COALESCE(im."IS_DELETED", false) = false
    ORDER BY im."MSTR_NM", im."MSTR_ID"`;
  return rows.map((r) => ({ value: Number(r.value), label: r.label }));
}

/** CI getAllKnsEmp(): the brand's managers (IS_MANAGER = 1), by full name. */
export async function managerOptions(subject: RequestSubject): Promise<IdLabel[]> {
  const brand = subject.adminLevel === 2 && !subject.oaBrandId ? null : (subject.oaBrandId ?? -1);
  const rows = await prisma.$queryRawUnsafe<Array<{ value: number; label: string }>>(
    `SELECT em."EMP_ID" AS value, ${fullName('em')} AS label FROM emp_mst em
     WHERE em."IS_MANAGER" ~ '^\\s*0*1(\\.0*)?\\s*$' AND em."IS_DELETED" = 0 AND ($1::int IS NULL OR em."OA_BRAND_ID" = $1::int)
     ORDER BY label, em."EMP_ID"`,
    brand,
  );
  return rows.map((r) => ({ value: Number(r.value), label: r.label || `Employee #${r.value}` }));
}
