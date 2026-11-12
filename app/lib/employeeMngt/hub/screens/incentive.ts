import { incentiveDefs } from '../defs/incentive';
import { asId, masterName, type HubConfig } from '../hubEngine';
import { keepCurrent, masterLabel, mastersByCode } from '../hubOptions';

/**
 * CI incentive/incentive ("Incentive"): an employee's incentives and arrears for a pay month (table incentive;
 * EMP_ID and the type are ids stored as text, the month as text MM/YYYY). Generate Salary adds the employee's
 * total for the month to the payslip line "Incentives/Arrears"; the Paid flag is HR's own marker (nothing
 * reads it).
 *
 * As CI: the list shows current employees unless another status is chosen; several entries per employee and
 * month are allowed (payroll adds them up); Mark As Paid / Unpaid on the selected rows.
 * Behaviour changes: only admins add, edit, delete or mark (CI had no check at all, and any record could be
 * changed by id — a normal user could pay themself an incentive); the record is the employee's and stays with
 * them on edit (CI moved it to the editor's brand); the month must be MM/YYYY and at most 10 months ahead and
 * the amount a number (CI accepted any text, which payroll then never matched); a zero amount is refused; delete
 * is soft (CI's row delete was hard).
 */
const MONTH_AHEAD = 10;

/** "M/YYYY", "MM/YYYY" or "YYYY-MM" → "MM/YYYY" (null when it is none of them). */
export function normaliseMonth(value: string | boolean): string | null {
  const v = String(value).trim();
  const slash = /^(\d{1,2})\/(\d{4})$/.exec(v);
  const dash = /^(\d{4})-(\d{2})$/.exec(v);
  const [month, year] = slash ? [Number(slash[1]), Number(slash[2])] : dash ? [Number(dash[2]), Number(dash[1])] : [0, 0];
  if (month < 1 || month > 12 || year < 2000 || year > 2099) return null;
  return `${String(month).padStart(2, '0')}/${year}`;
}

const AMOUNT_RE = /^-?\d{1,8}(\.\d{1,2})?$/;

export const incentiveConfig: HubConfig = {
  key: 'incentive',
  defs: incentiveDefs,
  table: 'incentive',
  pk: 'INCENTIVE_ID',
  empColumn: 'EMP_ID',
  // EMP_ID is varchar.
  from: `incentive t JOIN emp_mst em ON em."EMP_ID" = ${asId('t."EMP_ID"')}`,
  alive: 't."IS_DELETED" = 0',
  listColumns: `t."DATE",
    to_char(CASE WHEN t."DATE" ~ '^(0[1-9]|1[0-2])/[0-9]{4}$' THEN to_date(t."DATE", 'MM/YYYY') END, 'YYYY-MM') AS "PERIOD",
    ${masterName('t."INCENTIVE"')} AS "INCENTIVE_NM",
    (SELECT im."MSTR_CD" FROM independent_mst im WHERE im."MSTR_ID" = ${asId('t."INCENTIVE"')} LIMIT 1) AS "INCENTIVE_CD",
    to_char(t."AMOUNT", 'FM99999999990.00') AS "AMOUNT", t."COMMENTS", t."PAID_FLAG",
    CASE WHEN t."PAID_FLAG" = 1 THEN 'Yes' ELSE 'No' END AS "PAID",
    (SELECT im."MSTR_CD" FROM independent_mst im WHERE im."MSTR_ID" = em."EMP_STATUS_ID" LIMIT 1) AS "EMP_STATUS_CD"`,
  search: ['INCENTIVE_NM', 'DATE', 'COMMENTS', 'AMOUNT'],
  sorts: ['PERIOD', 'INCENTIVE_NM', 'AMOUNT', 'PAID'],
  bind: { MONTH_YEAR: 'DATE', INCENTIVE: 'INCENTIVE', AMOUNT: 'AMOUNT', COMMENTS: 'COMMENTS' },
  deleteMode: 'soft',
  adminOnlyWrites: true,
  messages: { created: 'Successfully Added Incentive Details', updated: 'Successfully Updated Incentive Details', deleted: 'Successfully Deleted' },

  // CI customFields: employment status (Current unless chosen; "all" = every status) and type.
  listFilter(q, sql) {
    const conditions: string[] = [];
    const status = (q.status ?? '').trim();
    if (status !== 'all') conditions.push(`v."EMP_STATUS_CD" = ${sql.p(/^[A-Z]{2,10}$/.test(status) ? status : 'EMSC')}`);
    const type = (q.type ?? '').trim();
    if (/^[A-Z]{2,10}$/.test(type)) conditions.push(`v."INCENTIVE_CD" = ${sql.p(type)}`);
    return conditions.length ? conditions.join(' AND ') : null;
  },

  options: async (_subject, _brand, row) => ({
    types: await keepCurrent(await mastersByCode('CTSAO'), row?.INCENTIVE, masterLabel),
  }),
  defaults: async () => {
    const now = new Date();
    return { MONTH_YEAR: `${String(now.getUTCMonth() + 1).padStart(2, '0')}/${now.getUTCFullYear()}` };
  },

  validate(v, check, ctx) {
    const changed = (name: string) => !ctx.existing || v[name] !== ctx.existing[name];
    if (!check.has('MONTH_YEAR') && v.MONTH_YEAR && changed('MONTH_YEAR')) {
      const month = normaliseMonth(v.MONTH_YEAR);
      if (!month) check.fail('MONTH_YEAR', 'The Month/Year field must be a month in MM/YYYY format.');
      else {
        const [m, y] = month.split('/').map(Number);
        const now = new Date();
        if (y * 12 + m > now.getUTCFullYear() * 12 + now.getUTCMonth() + 1 + MONTH_AHEAD) {
          check.fail('MONTH_YEAR', `The Month/Year cannot be more than ${MONTH_AHEAD} months ahead.`);
        } else v.MONTH_YEAR = month;
      }
    }
    const amount = String(v.AMOUNT).trim();
    if (!check.has('AMOUNT') && amount && changed('AMOUNT')) {
      if (!AMOUNT_RE.test(amount)) check.fail('AMOUNT', 'The Amount field must be a number with at most 8 digits before and 2 after the decimal point.');
      else if (Number(amount) === 0) check.fail('AMOUNT', 'The Amount field cannot be zero.');
    }
  },

  // USER_ID is NOT NULL: the employee's login, else the actor (the ownership columns win when the employee has one).
  extraColumns: (_v, ctx) => ({ USER_ID: ctx.employee.userId ?? ctx.subject.userId }),
};
