import type { HubScreenDefs } from '../hubFields';

/** CI employeeMngt/membership — an employee's professional memberships (columns of membership_vw). */
export const membershipDefs: HubScreenDefs = {
  fields: [
    { name: 'membership', label: 'Membership', type: 'select', required: true, options: 'memberships', attribute: 'MEMBERSHIP_NM' },
    { name: 'membershipfr', label: 'Membership Period', type: 'select', required: true, options: 'periods', attribute: 'MEMBERSHIP_FR' },
    { name: 'SubscriptionPaidByffo', label: 'Subscription Paid By', type: 'select', required: true, options: 'paidBy', attribute: 'SUBSCRIPTION_PAID_BY_NM' },
    { name: 'SubscriptionAmount', label: 'Subscription Amount', type: 'text', required: true, max: 13, attribute: 'SUBSCRIPTION_AMOUNT' },
    { name: 'Currency', label: 'Currency', type: 'select', options: 'currencies', attribute: 'CURRENCY' },
    { name: 'SubscriptionCommenceDate', label: 'Subscription Commence Date', type: 'date', attribute: 'SUBSCRIPTION_COMMENCE_DATE' },
    { name: 'SubscriptionRenewalDate', label: 'Subscription Renewal Date', type: 'date', attribute: 'SUBSCRIPTION_REVEWAL_DATE' },
    { name: 'Profilesummary', label: 'Profile Summary', type: 'textarea', max: 250, attribute: 'PROFILE_SUMMARY' },
  ],
  columns: [
    { key: 'EMP_NBR', header: 'Employee Code', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Employee Full Name', sortable: true },
    { key: 'SUBSCRIPTION_AMOUNT', header: 'Subscription Amount' },
    { key: 'MEMBERSHIP_NM', header: 'Membership Name', sortable: true },
    { key: 'MEMBERSHIP_FR', header: 'Membership Period', sortable: true },
    { key: 'SUBSCRIPTION_COMMENCE_DATE', header: 'Subscription Commence Date', format: 'date', sortable: true },
    { key: 'SUBSCRIPTION_PAID_BY_NM', header: 'Subscription Paid By', sortable: true },
    { key: 'SUBSCRIPTION_REVEWAL_DATE', header: 'Subscription Renewal Date', format: 'date', sortable: true },
    { key: 'PROFILE_SUMMARY', header: 'Profile Summary' },
    { key: 'CURRENCY', header: 'Currency' },
    { key: 'OA_BRAND_CD', header: 'Brand' },
  ],
};
