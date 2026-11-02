import type { HubScreenDefs } from '../hubFields';

/** CI employeeMngt/bank_dtl — an employee's bank accounts (columns of bank_dtl_vw). */
export const bankDtlDefs: HubScreenDefs = {
  fields: [
    { name: 'bankNm', label: 'Bank Name', type: 'text', required: true, max: 250, attribute: 'BANK_NM' },
    { name: 'branchNm', label: 'Branch Name', type: 'text', required: true, max: 250, attribute: 'BRANCH_NM' },
    { name: 'branchAddress', label: 'Branch Address', type: 'textarea', required: true, max: 250, attribute: 'BRANCH_ADDRESS' },
    { name: 'AccholderNm', label: 'Account Holder Name', type: 'text', required: true, max: 250, attribute: 'ACCOUNT_HOLDER_NM' },
    // CI required the Sort Code everywhere; an Indian account has an IFSC code instead.
    { name: 'sortCd', label: 'Sort Code', type: 'text', max: 11, attribute: 'SORT_CD', required: (_v, flags) => !flags.india },
    { name: 'AccNo', label: 'Account No', type: 'text', required: true, max: 18, attribute: 'ACCOUNT_NO' },
    { name: 'ifscCd', label: 'IFSC Code', type: 'text', max: 11, attribute: 'IFSC_CD', required: (_v, flags) => !!flags.india },
    { name: 'isPrimary', label: 'Is Primary', type: 'checkbox', attribute: 'IS_PRIMARY' },
  ],
  columns: [
    { key: 'EMP_NBR', header: 'Employee Code', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Employee Name', attribute: 'EMP_NAME', sortable: true },
    { key: 'BANK_NM', header: 'Bank Name', sortable: true },
    { key: 'BRANCH_NM', header: 'Branch Name', sortable: true },
    { key: 'BRANCH_ADDRESS', header: 'Branch Address' },
    { key: 'IFSC_CD', header: 'IFSC Code' },
    { key: 'SORT_CD', header: 'Sort Code' },
    { key: 'ACCOUNT_NO', header: 'Account No' },
    { key: 'ACCOUNT_HOLDER_NM', header: 'Account Holder Name', sortable: true },
    { key: 'IS_PRIMARY', header: 'Is Primary', format: 'yesno', sortable: true },
    { key: 'OA_BRAND_CD', header: 'Brand' },
  ],
};
