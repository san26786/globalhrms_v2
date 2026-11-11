import { BusinessRuleError } from '@/lib/http/errors';
import { resolvePair } from '@/lib/payroll/annexure/pair';
import { annexureProcessingDefs, myAnnexuresDefs } from '../defs/annexures';
import { isoDate, masterName, type HubConfig } from '../hubEngine';

/**
 * CI employeeMngt/emp_sal_component_mst/indexAnnexures ("Annexure Processing", admins) and …/annexures ("My
 * Annexures", also the employee tab emp_annexures/{EMP_ID}): salary annexures — emp_basic_sal_mst headers of
 * SAL_TYPE PRSTAX, a yearly one and one of the brand's pay frequency per annexure (lib/payroll/annexure/pair.ts).
 * Payroll pays from the employee's current annexure of the brand's frequency.
 *
 * As CI: Annexure Processing lists both headers, current employees unless another status is chosen; My
 * Annexures lists the yearly headers. Behaviour changes: Is Current is shown (CI's Form Settings hid it) and
 * reads Yes on both headers of the current annexure; the month / year filter filters (CI's box did nothing) and
 * "All employees" lists every status (CI's gave an empty list); delete takes the whole annexure — both headers
 * and their components (CI deleted one header and left half an annexure) — and is refused for the current one;
 * the component editor behind CI's Edit is not migrated (regenerate instead); annexures of deleted employees
 * are not listed.
 */
const PAIR_CURRENT = `CASE WHEN t."IS_CURRENT" = 1 OR EXISTS (
    SELECT 1 FROM emp_basic_sal_mst p
    WHERE p."EMP_ID" = t."EMP_ID" AND p."SAL_TYPE" = t."SAL_TYPE" AND p."IS_DELETED" = 0 AND p."IS_CURRENT" = 1
      AND p."EMP_SAL_ID" IN (t."EMP_SAL_ID" - 1, t."EMP_SAL_ID" + 1)
      AND p."MONTH" IS NOT DISTINCT FROM t."MONTH" AND p."YEAR" IS NOT DISTINCT FROM t."YEAR"
      AND p."EFFECTIVE_DATE" IS NOT DISTINCT FROM t."EFFECTIVE_DATE")
  THEN 'Yes' ELSE 'No' END`;
const amount = (column: string) => `to_char(t."${column}", 'FM99999999999999990.00') AS "${column}", t."${column}" AS "${column}_N"`;
const asInt = (column: string, digits: string) => `CASE WHEN t."${column}" ~ '^\\s*[0-9]{${digits}}\\s*$' THEN btrim(t."${column}")::int END`;

const LIST_COLUMNS = `${masterName('t."EMP_GRADE_ID"')} AS "EMP_GRADE", ${masterName('t."POSITION_ID"')} AS "POSTION_NM",
  (SELECT c."CURR_NAME" FROM currency_mst c WHERE c."CURR_ID" = t."CURRENCY_ID" LIMIT 1) AS "CURRENCY_NM",
  (SELECT b."ACCOUNT_NO" FROM bank_dtl b WHERE b."EMP_ID" = t."EMP_ID" AND btrim(COALESCE(b."IS_DELETED", '0'), '''') = '0'
   ORDER BY b."BANK_ID" DESC LIMIT 1) AS "ACCOUNT_NO",
  ${amount('ACTUAL_AMOUNT')}, ${amount('EARNED_AMOUNT')},
  t."MONTH", t."YEAR", ${asInt('MONTH', '1,2')} AS "MONTH_N", ${asInt('YEAR', '4')} AS "YEAR_N",
  ${isoDate('t."EFFECTIVE_DATE"')} AS "EFFECTIVE_DATE",
  ${masterName('t."PAY_FREQUENCY_ID"')} AS "PAY_FREQUENCY",
  (SELECT im."MSTR_CD" FROM independent_mst im WHERE im."MSTR_ID" = t."PAY_FREQUENCY_ID" LIMIT 1) AS "PAY_FREQUENCY_CD",
  t."IS_CURRENT", ${PAIR_CURRENT} AS "IS_CURRENT_NM", t."COMMENTS",
  (SELECT im."MSTR_CD" FROM independent_mst im WHERE im."MSTR_ID" = em."EMP_STATUS_ID" LIMIT 1) AS "EMP_STATUS_CD"`;

const ALIVE = `t."IS_DELETED" = 0 AND t."SAL_TYPE" = (SELECT im."MSTR_ID" FROM independent_mst im WHERE im."MSTR_CD" = 'PRSTAX' ORDER BY im."MSTR_ID" LIMIT 1)`;
const STATUS = /^[A-Z]{2,10}$/;

const shared = {
  table: 'emp_basic_sal_mst',
  pk: 'EMP_SAL_ID',
  empColumn: 'EMP_ID',
  alive: ALIVE,
  listColumns: LIST_COLUMNS,
  search: ['EMP_GRADE', 'POSTION_NM', 'CURRENCY_NM', 'MONTH', 'YEAR', 'PAY_FREQUENCY', 'COMMENTS'],
  sorts: ['EMP_GRADE', 'POSTION_NM', 'CURRENCY_NM', 'ACTUAL_AMOUNT_N', 'EARNED_AMOUNT_N', 'MONTH_N', 'YEAR_N', 'EFFECTIVE_DATE', 'PAY_FREQUENCY', 'IS_CURRENT_NM'],
  bind: {},
  deleteMode: 'soft' as const,
  noCreate: true,
  noEdit: true,
};

export const annexureProcessingConfig: HubConfig = {
  ...shared,
  key: 'annexure_processing',
  defs: annexureProcessingDefs,
  adminOnlyWrites: true,
  messages: { created: '', updated: '', deleted: 'Successfully Deleted' },

  // Employment status (current unless chosen; "all"), the header's frequency, current only, the annexure's month.
  listFilter(q, sql) {
    const c: string[] = [];
    const status = (q.status ?? '').trim();
    if (status !== 'all') c.push(`v."EMP_STATUS_CD" = ${sql.p(STATUS.test(status) ? status : 'EMSC')}`);
    if (q.frequency === 'yearly') c.push(`v."PAY_FREQUENCY_CD" = 'PFYLY'`);
    if (q.frequency === 'period') c.push(`v."PAY_FREQUENCY_CD" IS DISTINCT FROM 'PFYLY'`);
    if (q.current === '1') c.push(`v."IS_CURRENT_NM" = 'Yes'`);
    const m = /^(0?[1-9]|1[0-2])\/(\d{4})$/.exec((q.monthYear ?? '').trim());
    if (m) c.push(`v."MONTH_N" = ${sql.p(Number(m[1]))}::int AND v."YEAR_N" = ${sql.p(Number(m[2]))}::int`);
    return c.length ? c.join(' AND ') : null;
  },

  /** The whole annexure: both headers and their components; never the current one. */
  async remove(tx, ctx) {
    const pair = await resolvePair(tx, ctx.id!);
    if (!pair) throw new BusinessRuleError('Record not found.');
    const [current] = await tx.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM emp_basic_sal_mst WHERE "EMP_SAL_ID" = ANY(${pair.ids}::int[]) AND "IS_CURRENT" = 1`;
    if (current.n) throw new BusinessRuleError("This is the employee's current annexure. Mark another annexure current before deleting it.");
    await tx.$executeRaw`
      UPDATE emp_basic_sal_mst SET "IS_DELETED" = 1, "UPDATED_BY" = ${ctx.subject.userId}, "UPDATED_ON" = now() WHERE "EMP_SAL_ID" = ANY(${pair.ids}::int[])`;
    await tx.$executeRaw`
      UPDATE emp_basic_sal_dtl SET "IS_DELETED" = 1, "UPDATED_BY" = ${ctx.subject.userId}, "UPDATED_ON" = now()
      WHERE "SAL_MST_ID" = ANY(${pair.ids}::int[]) AND "IS_DELETED" = 0`;
  },
};

export const myAnnexuresConfig: HubConfig = {
  ...shared,
  key: 'my_annexures',
  defs: myAnnexuresDefs,
  noDelete: true,
  messages: { created: '', updated: '', deleted: '' },
  // The yearly headers (CI); an admin's list also filters by employment status (only admins send it).
  listFilter(q, sql) {
    const c = [`v."PAY_FREQUENCY_CD" = 'PFYLY'`];
    const status = (q.status ?? '').trim();
    if (STATUS.test(status)) c.push(`v."EMP_STATUS_CD" = ${sql.p(status)}`);
    return c.join(' AND ');
  },
};

