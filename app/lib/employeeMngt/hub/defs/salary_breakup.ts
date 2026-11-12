import type { HubColumnDef, HubScreenDefs } from '../hubFields';

/**
 * CI employeeMngt/emp_sal_component_dtl/SalaryBreakUp ("Salary Breakup", salary_breakup_vw): one row per employee and
 * financial year. List-only. Columns keep the view's attributes, so Form Settings still label and hide them.
 */
export const SALARY_BREAKUP_MONEY: Array<{ key: string; header: string }> = [
  ['WEEKLY_SALARY', 'Weekly Salary'], ['MONTHLY_SALARY', 'Monthly Salary'], ['ANNUAL_SALARY', 'Annual Salary'], ['CTC', 'CTC'],
  ['CUM_GROSS_EARNINGS', 'Cum Gross Earnings'], ['CUM_GROSS_DEDUCTIONS', 'Cum Gross Deductions'], ['CUM_GROSS_CONTRIBUTIONS', 'Cum Gross Contributions'],
  ['BASIC', 'Basic'], ['HRA', 'HRA'], ['CONVEYANCE_ALLOWANCE', 'Conveyance Allowance'], ['MEDICAL_ALLOWANCE', 'Medical Allowance'],
  ['TELEPHONE_ALLOWANCE', 'Telephone Allowance'], ['SPECIAL_ALLOWANCE', 'Special Allowance'], ['GRATUITY', 'Gratuity'],
  ['MEDICAL_INSURANCE', 'Medical Insurance'], ['STATUTORY_BONUS', 'Statutory Bonus'], ['CITY_COMPENSATORY_ALLOWANCE', 'City Compensatory Allowance'],
  ['EDUCATION', 'Education'], ['LTA', 'LTA'], ['DEARNESS_ALLOWANCE', 'Dearness Allowance'], ['CAR_LEASE', 'Car Lease'], ['MEAL_VOUCHERS', 'Meal Vouchers'],
  ['ADHOC_ALLOWANCE', 'Adhoc Allowance'], ['PROFESSIONAL_TAX', 'Professional Tax'], ['PROVIDENT_FUND', 'Provident Fund'],
  ['EMPLOYER_PROVIDENT_FUND', 'Employer Provident Fund'], ['ESIC', 'ESIC'], ['EMPLOYER_ESIC_CONTRIBUTIONS', 'Employer ESIC Contributions'],
  ['INCOME_TAX', 'Income Tax'], ['EMPLOYER_PENSION_FUND_CONTRIBUTIONS', 'Employer Pension Fund Contributions'],
  ['EMPLOYER_LEAVE_CONTRIBUTIONS', 'Employer Leave Contributions'], ['LOP_DEDUCTIONS', 'LOP Deductions'],
].map(([key, header]) => ({ key, header }));

export const salaryBreakupDefs: HubScreenDefs = {
  fields: [],
  columns: [
    { key: 'EMP_NBR', header: 'Employee Code', attribute: 'EMP_CD', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Employee Name', attribute: 'EMP_NM', sortable: true },
    { key: 'YEAR', header: 'Year', attribute: 'YEAR', sortable: true, sortKey: 'YEAR_START' },
    { key: 'DAILY_SALARY', header: 'Daily Salary', attribute: 'DAILY_SALARY', sortable: true, sortKey: 'DAILY_SALARY_N' },
    ...SALARY_BREAKUP_MONEY.map((c): HubColumnDef => ({ key: c.key, header: c.header, attribute: c.key, sortable: true, sortKey: `${c.key}_N` })),
  ],
};
