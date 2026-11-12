import { salaryComponentsDefs } from '../defs/salary_components';
import { masterName, type HubConfig } from '../hubEngine';
import { MONTH_YEAR, STATUS } from './payslips';

/**
 * CI employeeMngt/emp_sal_component_dtl (index: "Component Wise Salary Breakup"): the lines of the payslips — one row
 * per payslip and salary component, with its type (Additions / Deductions / Contributions), the amount the payslip
 * prints and, on the LOP line, the LOP days.
 *
 * Behaviour changes: the month and employment-status filters apply (CI's filters never reached its query, so it listed
 * the brand's whole history); payslip lines only (CI mixed in annexure rows, the three component-less 0.00 rows of every
 * CI payslip and a second Mediclaim row — its sums were wrong); read-only (CI's edit form could not save and its delete
 * left the payslip's net unchanged); raw id columns dropped; the menu grant is checked.
 */
const PRSTPS = `(SELECT im."MSTR_ID" FROM independent_mst im WHERE im."MSTR_CD" = 'PRSTPS' ORDER BY im."MSTR_ID" LIMIT 1)`;
const validMonth = `h."MONTH" ~ '^\\s*[0-9]{1,2}\\s*$' AND h."YEAR" ~ '^\\s*[0-9]{4}\\s*$'`;
const daysIn = `extract(day FROM (make_date(btrim(h."YEAR")::int, btrim(h."MONTH")::int, 1) + interval '1 month - 1 day'))`;

export const salaryComponentsConfig: HubConfig = {
  key: 'salary_components',
  defs: salaryComponentsDefs,
  table: 'emp_basic_sal_dtl',
  pk: 'EMP_BASIC_SAL_DTL_ID',
  empColumn: null,
  from: `emp_basic_sal_dtl t
    JOIN emp_basic_sal_mst h ON h."EMP_SAL_ID" = t."SAL_MST_ID"
    JOIN emp_mst em ON em."EMP_ID" = h."EMP_ID"
    LEFT JOIN independent_mst c ON c."MSTR_ID" = t."SAL_COMP_ID"
    LEFT JOIN LATERAL (SELECT s."SC_ID", ct."MSTR_CD" AS type_cd, ct."MSTR_NM" AS type_nm
        FROM salary_component_settings s JOIN independent_mst ct ON ct."MSTR_ID" = s."COMPONENT_TYPE"
        WHERE s."OA_BRAND_ID" = em."OA_BRAND_ID" AND s."COMPONENT_ID" = t."SAL_COMP_ID" AND s."IS_DELETED" = 0
        ORDER BY s."SC_ID" LIMIT 1) sc ON true`,
  // The payslip's first live row per component (a CI payslip carries a second Mediclaim row and component-less rows).
  alive: `t."IS_DELETED" = 0 AND h."IS_DELETED" = 0 AND t."SAL_COMP_ID" IS NOT NULL AND h."SAL_TYPE" = ${PRSTPS}
    AND NOT EXISTS (SELECT 1 FROM emp_basic_sal_dtl x WHERE x."SAL_MST_ID" = t."SAL_MST_ID" AND x."SAL_COMP_ID" = t."SAL_COMP_ID"
                    AND x."IS_DELETED" = 0 AND x."EMP_BASIC_SAL_DTL_ID" < t."EMP_BASIC_SAL_DTL_ID")`,
  listColumns: `h."EMP_SAL_ID" AS "PAYSLIP_ID", h."MONTH", h."YEAR",
    CASE WHEN h."MONTH" ~ '^\\s*[0-9]{1,2}\\s*$' THEN btrim(h."MONTH")::int END AS "MONTH_N",
    CASE WHEN h."YEAR" ~ '^\\s*[0-9]{4}\\s*$' THEN btrim(h."YEAR")::int END AS "YEAR_N",
    t."SAL_COMP_ID", c."MSTR_NM" AS "SALARY_COMPONENT",
    CASE WHEN c."MSTR_CD" = 'SCBS' THEN 'Additions' WHEN c."MSTR_CD" = 'SCLOP' THEN 'Deductions' ELSE sc.type_nm END AS "COMPONENT_TYPE",
    (CASE WHEN c."MSTR_CD" = 'SCBS' THEN 0 WHEN sc.type_cd = 'CMPTA' THEN 1 WHEN c."MSTR_CD" = 'SCLOP' THEN 2
          WHEN sc.type_cd = 'CMPTD' THEN 3 WHEN sc.type_cd = 'CMPTC' THEN 4 ELSE 5 END) * 1000000
      + COALESCE(sc."SC_ID", t."SAL_COMP_ID") AS "COMPONENT_ORDER",
    to_char(t."ACTUAL_AMOUNT", 'FM99999999999999990.00') AS "ACTUAL_AMOUNT", t."ACTUAL_AMOUNT" AS "ACTUAL_AMOUNT_N",
    to_char(t."EARNED_AMOUNT", 'FM99999999999999990.00') AS "EARNED_AMOUNT", t."EARNED_AMOUNT" AS "EARNED_AMOUNT_N",
    ${masterName('t."PAY_FREQUENCY_ID"')} AS "PAY_FREQUENCY",
    CASE WHEN c."MSTR_CD" = 'SCLOP' THEN 'LOP days: ' || (CASE
         WHEN btrim(COALESCE(t."COMPONENT_DESC", '')) ~ '^[0-9]+(\\.[0-9]+)?$' THEN btrim(t."COMPONENT_DESC")::numeric::float8
         WHEN t."ACTUAL_AMOUNT" <> 0 AND h."ACTUAL_AMOUNT" <> 0 AND ${validMonth}
           THEN (round(t."ACTUAL_AMOUNT" * ${daysIn} / h."ACTUAL_AMOUNT" * 2) / 2)::float8
         ELSE 0 END)::text
       ELSE NULLIF(btrim(t."COMPONENT_DESC"), '') END AS "DESCRIPTION",
    NULLIF(btrim(t."COMMENTS"), '') AS "REMARKS",
    ${masterName('em."EMP_STATUS_ID"')} AS "EMP_STATUS",
    (SELECT im."MSTR_CD" FROM independent_mst im WHERE im."MSTR_ID" = em."EMP_STATUS_ID" LIMIT 1) AS "EMP_STATUS_CD"`,
  search: ['SALARY_COMPONENT', 'COMPONENT_TYPE', 'MONTH', 'YEAR', 'DESCRIPTION', 'REMARKS', 'EMP_STATUS'],
  sorts: ['MONTH_N', 'YEAR_N', 'SALARY_COMPONENT', 'COMPONENT_TYPE', 'ACTUAL_AMOUNT_N', 'EARNED_AMOUNT_N', 'PAY_FREQUENCY', 'EMP_STATUS'],
  defaultSort: 'v."YEAR_N" DESC NULLS LAST, v."MONTH_N" DESC NULLS LAST, v."EMP_FULL_NAME", v."PAYSLIP_ID", v."COMPONENT_ORDER", v.id',
  bind: {},
  deleteMode: 'hard',
  noCreate: true,
  noEdit: true,
  noDelete: true,
  messages: { created: '', updated: '', deleted: '' },
  // Employment status (current unless chosen; "all"), the payslip month (empty: every month).
  listFilter(q, sql) {
    const c: string[] = [];
    const status = (q.status ?? '').trim();
    if (status !== 'all') c.push(`v."EMP_STATUS_CD" = ${sql.p(STATUS.test(status) ? status : 'EMSC')}`);
    const m = MONTH_YEAR.exec((q.monthYear ?? '').trim());
    if (m) c.push(`v."MONTH_N" = ${sql.p(Number(m[1]))}::int AND v."YEAR_N" = ${sql.p(Number(m[2]))}::int`);
    return c.length ? c.join(' AND ') : null;
  },
};
