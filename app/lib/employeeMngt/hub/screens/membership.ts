import { prisma } from '@/lib/prisma';
import type { IdLabel } from '@/lib/systmMngt/shared';
import { membershipDefs } from '../defs/membership';
import { masterName, type HubConfig } from '../hubEngine';
import { brandMasters, keepCurrent, masterLabel } from '../hubOptions';

/**
 * CI employeeMngt/membership ("Membership"): an employee's professional memberships and subscriptions
 * (table membership).
 *
 * Behaviour changes: the profile summary is on the form (CI hid the field and wiped stored summaries on
 * every save); amounts may have two decimals (CI: whole numbers); the renewal date must be after the
 * commence date (CI only rejected equal dates); currencies are the employee's brand's (CI: the logged-in
 * user's brand, deleted ones included) and "no currency" is NULL (CI: 0); a normal user sees the
 * memberships of their employee record (CI: rows stamped with their user id, so ones an admin added for
 * them stayed hidden).
 */
const MEMBERSHIP = 289;
const PAID_BY = 290;
const PERIOD = 573; // hard-coded in CI

async function currencyOptions(brand: number | null): Promise<IdLabel[]> {
  const rows = await prisma.$queryRaw<Array<{ value: number; label: string }>>`
    SELECT DISTINCT ON (c."CURR_NAME") c."CURR_ID" AS value, c."CURR_NAME" AS label
    FROM currency_mst c WHERE c."IS_DELETED" = 0 AND c."OA_BRAND_ID" = ${brand ?? -1}
    ORDER BY c."CURR_NAME", c."CURR_ID"`;
  return rows.map((r) => ({ value: Number(r.value), label: r.label }));
}

async function currencyLabel(id: number): Promise<string | null> {
  const row = await prisma.currency_mst.findFirst({ where: { CURR_ID: id }, select: { CURR_NAME: true } });
  return row?.CURR_NAME ?? null;
}

export const membershipConfig: HubConfig = {
  key: 'membership',
  defs: membershipDefs,
  table: 'membership',
  pk: 'MEMBERSHIP_ID',
  empColumn: 'EMP_ID',
  alive: 't."IS_DELETED" = 0',
  listColumns: `t."SUBSCRIPTION_AMOUNT", ${masterName('t."MEMBERSHIP"')} AS "MEMBERSHIP_NM", ${masterName('t."MEMBERSHIP_FR"')} AS "MEMBERSHIP_FR",
    to_char(t."SUBSCRIPTION_COMMENCE_DATE", 'YYYY-MM-DD') AS "SUBSCRIPTION_COMMENCE_DATE",
    ${masterName('t."SUBSCRIPTION_PAID_BY"')} AS "SUBSCRIPTION_PAID_BY_NM",
    to_char(t."SUBSCRIPTION_REVEWAL_DATE", 'YYYY-MM-DD') AS "SUBSCRIPTION_REVEWAL_DATE", t."PROFILE_SUMMARY",
    (SELECT c."CURR_NAME" FROM currency_mst c WHERE c."CURR_ID" = t."CURRENCY_ID" LIMIT 1) AS "CURRENCY"`,
  search: ['MEMBERSHIP_NM', 'MEMBERSHIP_FR', 'SUBSCRIPTION_PAID_BY_NM', 'PROFILE_SUMMARY'],
  sorts: ['MEMBERSHIP_NM', 'MEMBERSHIP_FR', 'SUBSCRIPTION_PAID_BY_NM', 'SUBSCRIPTION_COMMENCE_DATE', 'SUBSCRIPTION_REVEWAL_DATE'],
  bind: {
    membership: 'MEMBERSHIP', membershipfr: 'MEMBERSHIP_FR', SubscriptionPaidByffo: 'SUBSCRIPTION_PAID_BY', SubscriptionAmount: 'SUBSCRIPTION_AMOUNT',
    Currency: 'CURRENCY_ID', SubscriptionCommenceDate: 'SUBSCRIPTION_COMMENCE_DATE', SubscriptionRenewalDate: 'SUBSCRIPTION_REVEWAL_DATE',
    Profilesummary: 'PROFILE_SUMMARY',
  },
  deleteMode: 'soft',
  messages: { created: 'Successfully Added Membership Details', updated: 'Successfully Updated Membership Details', deleted: 'Successfully Deleted' },

  options: async (_subject, brand, row) => {
    const [memberships, periods, paidBy, currencies] = await Promise.all([
      brandMasters({ id: MEMBERSHIP }, brand),
      brandMasters({ id: PERIOD }, brand),
      brandMasters({ id: PAID_BY }, brand),
      currencyOptions(brand),
    ]);
    return {
      memberships: await keepCurrent(memberships, row?.MEMBERSHIP, masterLabel),
      periods: await keepCurrent(periods, row?.MEMBERSHIP_FR, masterLabel),
      paidBy: await keepCurrent(paidBy, row?.SUBSCRIPTION_PAID_BY, masterLabel),
      currencies: await keepCurrent(currencies, row?.CURRENCY_ID, currencyLabel),
    };
  },

  validate(v, check, ctx) {
    const changed = (name: string) => v[name] !== ctx.existing?.[name];
    const amount = String(v.SubscriptionAmount);
    if (amount && changed('SubscriptionAmount') && !check.has('SubscriptionAmount')
      && (!/^\d{1,10}(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0)) {
      check.fail('SubscriptionAmount', 'The Subscription Amount field must be a positive amount with up to 2 decimals.');
    }
    const start = String(v.SubscriptionCommenceDate);
    const renewal = String(v.SubscriptionRenewalDate);
    if (start && renewal && (changed('SubscriptionCommenceDate') || changed('SubscriptionRenewalDate'))
      && !check.has('SubscriptionCommenceDate') && !check.has('SubscriptionRenewalDate')) {
      if (start === renewal) check.fail('SubscriptionRenewalDate', 'Both date must be different');
      else if (renewal < start) check.fail('SubscriptionRenewalDate', 'Subscription Renewal Date must be after Subscription Commence Date.');
    }
  },
};
