import type { HubColumnDef, HubFieldDef, HubScreenDefs } from '../hubFields';

/**
 * CI department_activity/* ("Exit and Clearance Formality"): an employee's exit clearance, one record per
 * department — Department Head / Supervisor (the list), G&A / Admin, Accounts / Finance, Facilities / IT and
 * Human Resource. Each checklist item is a status column (`<ITEM>_REMARKS`); CI's free-text comment
 * column next to it was never shown (`comment`, written empty). Shared by the forms and the server.
 */
export type ExitStepKey = 'exit_clearance' | 'exit_gna' | 'exit_finance' | 'exit_facilities' | 'exit_hr';

/** Status lists: literal values (Yes / No …) or masters of a type (Deposited / Not Deposited …). */
export const EXIT_LITERALS = {
  yesNo: ['Yes', 'No'],
  completed: ['Completed', 'Not Completed'],
  given: ['Given', 'Not Given'],
} as const;
export const EXIT_MASTERS = { deposit: 'DPOSIT', settle: 'SETLED', submit: 'SUBMIT' } as const;
export type ExitOptions = keyof typeof EXIT_LITERALS | keyof typeof EXIT_MASTERS;

export interface ExitItem {
  label: string;
  /** Status column (also the form field and Form Settings attribute). */
  column: string;
  /** CI's hidden comment column. */
  comment: string;
  options: ExitOptions;
}

export interface ExitStep {
  key: ExitStepKey;
  table: string;
  pk: string;
  /** URL segment under the clearance (steps 2–5). */
  segment?: string;
  items: ExitItem[];
}

const item = (label: string, column: string, options: ExitOptions, comment = column.replace(/_REMARKS$/, '')): ExitItem => ({ label, column, comment, options });

/** The steps in CI's "Save And Next" order. */
export const EXIT_STEPS: ExitStep[] = [
  {
    key: 'exit_clearance',
    table: 'department_head_supervisor',
    pk: 'DEP_HEAD_SUP_ID',
    items: [
      item('Project Related Documents / Software Handover', 'PROJECT_RELATED_DOCUMENTS_REMARKS', 'yesNo'),
      item('Inactivation of Communicator', 'INACTIVATION_OF_COMMUNICATOR_REMARKS', 'yesNo'),
      item('Inactivation of Email ID', 'INACTIVATION_OF_EMAIL_ID_REMARKS', 'yesNo'),
      item('Release of Machine/Laptops', 'RELEASE_MACHINE_LAPTOPS_REMARKS', 'yesNo'),
      item('Backup from Machine/Laptops', 'BACKUP_FROM_MACHINE_LAPTOPS_REMARKS', 'yesNo'),
    ],
  },
  {
    key: 'exit_gna',
    table: 'gna_and_admin',
    pk: 'GNA_ADMIN_ID',
    segment: 'gna',
    items: [
      item('Cabinet Keys', 'CABINET_KEYS_REMARKS', 'deposit'),
      item('Stationary/Plaques', 'STATIONARY_PLAQUES_REMARKS', 'deposit'),
      item('Monetary Dues', 'MONETARY_DUES_REMARKS', 'deposit'),
      item('Door Access/ ID Cards', 'DOOR_ACCESS_ID_CARDS_REMARKS', 'deposit'),
    ],
  },
  {
    key: 'exit_finance',
    table: 'account_finance',
    pk: 'ACCOUNT_FINANCE_ID',
    segment: 'finance',
    items: [
      item('Investment Proof', 'INVESTMENT_PROOF_REMARKS', 'deposit'),
      item('Relocation Expense', 'RELOCATION_EXPENSE_REMARKS', 'deposit'),
      item('Corporate Credit Card', 'CORPORATE_CREDIT_CARD_REMARKS', 'deposit'),
      item('Foreign Exchange', 'FOREGIN_EXCHANGE_REMARKS', 'deposit'),
    ],
  },
  {
    key: 'exit_facilities',
    table: 'facilities_it',
    pk: 'FACILITIES_IT_ID',
    segment: 'facilities',
    items: [
      item('Disk/CD', 'DISK_CD_REMARKS', 'deposit'),
      item('Company Mobile Phones', 'COMPANY_MOBILE_PHONES_REMARKS', 'deposit'),
      item('Machine Password', 'MACHINE_PASSWORD_REMARKS', 'deposit'),
    ],
  },
  {
    key: 'exit_hr',
    table: 'human_resource',
    pk: 'HUMAN_RESOURCE_ID',
    segment: 'hr',
    items: [
      item('Leave Balance', 'LEAVE_BALANCE_REMARKS', 'settle'),
      item('Salary Advance/Loan', 'SALARY_ADVANCE_LOAN_REMARKS', 'settle'),
      item('Exit Interview', 'EXIT_INTERVIEW_REMARKS', 'completed'),
      item('PF Forms', 'PF_FORMS_REMARKS', 'submit'),
      item('Experience Letter', 'EXPERIENCE_LETTER_REMARKS', 'given'),
    ],
  },
];

export const exitStep = (key: ExitStepKey) => EXIT_STEPS.find((s) => s.key === key)!;
export const exitStepBySegment = (segment: string) => EXIT_STEPS.find((s) => s.segment === segment) ?? null;

const itemField = (i: ExitItem): HubFieldDef => ({ name: i.column, label: i.label, type: 'select', options: i.options, attribute: i.column });
const itemColumn = (i: ExitItem): HubColumnDef => ({ key: i.column, header: i.label, attribute: i.column });

/** Department Head / Supervisor: the checklist, the handover and the KT plan; the clearance list. */
const [dh, ...others] = EXIT_STEPS;
const HANDOVER = 'PROJECT_RELATED_DOCUMENTS_REMARKS';

export const exitClearanceDefs: HubScreenDefs = {
  employeeLabel: 'Employee Name',
  employeeOptions: true,
  fields: [
    // From the employee's current job, at save time.
    { name: 'lastAppraisal', label: 'Last Appraisal Date', type: 'date', readOnly: () => true, hidden: (v) => !v.lastAppraisal, attribute: 'APPARAISAL_COMPLETED_REMARKS' },
    itemField(dh.items[0]),
    {
      name: 'CHARGE_HANDOVER_TO_REMARKS', label: 'Charge Handover to', type: 'select', options: 'handoverEmployees',
      hidden: (v) => v[HANDOVER] !== 'Yes', attribute: 'CHARGE_HANDOVER_TO_REMARKS',
    },
    { name: 'ktPlan', label: 'KT Plan Attachment', type: 'file', attribute: 'KT_PLAN_ATTECHMENT' },
    ...dh.items.slice(1).map(itemField),
  ],
  columns: [
    { key: 'EMP_NBR', header: 'Employee Code', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Employee Name', attribute: 'EMP_NM', sortable: true },
    { key: 'SEPARATION_DATE', header: 'Date of Separation', format: 'date', sortable: true },
    { key: 'APPARAISAL_COMPLETED_REMARKS', header: 'Last Appraisal Date', format: 'date', sortable: true },
    ...dh.items.map(itemColumn),
    { key: 'CHARGE_HANDOVER_TO_REMARKS_NM', header: 'Charge Handover to' },
    { key: 'STEPS_DONE', header: 'Departments Done' },
    { key: 'IS_GENERATED', header: 'Documents Generated', sortable: true },
    { key: 'CREATED_ON', header: 'Created On', format: 'date', sortable: true },
  ],
};

/** Steps 2–5: the department's checklist (no list of their own: they open from the clearance). */
export const exitStepDefs = Object.fromEntries(
  others.map((step) => [step.key, {
    employeeLabel: 'Employee',
    fields: step.items.map(itemField),
    columns: [
      { key: 'EMP_NBR', header: 'Employee Code' },
      { key: 'EMP_FULL_NAME', header: 'Employee Name', attribute: 'EMP_NM' },
      ...step.items.map((i) => ({ ...itemColumn(i), key: `${i.column}_NM` })),
    ],
  } satisfies HubScreenDefs]),
) as Record<Exclude<ExitStepKey, 'exit_clearance'>, HubScreenDefs>;
