import type { IdLabel } from '@/lib/systmMngt/shared';

/**
 * CI benefitrules/benefitrules/index/{code}: the four rule types on the Advance Settings menu, which
 * fields each uses, and the screen's data shapes — shared by the pages and the API (no server
 * imports). Service: ./benefitRules.
 */
export const RULE_TYPES = {
  BRTYSBR: { title: 'Benefit Rules', listColumns: ['component', 'calculationFactor', 'dependentOn', 'taxAllowanceType', 'lowerLimit', 'upperLimit', 'values', 'signFactor', 'openLimit', 'gender', 'month', 'financialYear', 'country', 'comment'] },
  BRTYIDR: { title: 'Investment Declaration Rules', listColumns: ['section', 'calculationFactor', 'lowerLimit', 'upperLimit', 'values', 'age', 'gender', 'expensesType', 'severeType', 'disabilityType', 'payment', 'openLimit', 'month', 'financialYear', 'country', 'comment'] },
  BRTYFDR: { title: 'Flat Deduction Rules', listColumns: ['calculationFactor', 'values', 'gender', 'month', 'financialYear', 'country', 'comment'] },
  BRTYRBE: { title: 'Rebate Rules', listColumns: ['calculationFactor', 'lowerLimit', 'upperLimit', 'values', 'signFactor', 'openLimit', 'gender', 'month', 'financialYear', 'country', 'comment'] },
} as const;

export type RuleTypeCode = keyof typeof RULE_TYPES;
export type RuleListColumn = (typeof RULE_TYPES)[RuleTypeCode]['listColumns'][number];

export function isRuleTypeCode(value: string | null | undefined): value is RuleTypeCode {
  return !!value && Object.prototype.hasOwnProperty.call(RULE_TYPES, value);
}

/** CI menu URL of a rule type — its permission grant decides list / add / edit / delete. */
export const ruleMenuUrl = (code: RuleTypeCode) => `benefitrules/benefitrules/index/${code}`;

/** "Conditional Monthly Value" calculation factor: the rule applies in one month (CI shows Month only then). */
export const CONDITIONAL_MONTHLY = 'CFCONR';

/**
 * Investment Declaration sections (EMPIAP master codes) → the extra fields they use
 * (CI benefitrules.js; any other section uses none).
 */
export const SECTION_FIELDS: Record<string, ReadonlyArray<SectionField>> = {
  IPCCD: ['payment'],
  IPCTN: [],
  IPME: ['age_id', 'medical_expenses'],
  DDTYPE: ['dependent_disability'],
  SEC80: ['disability_type'],
  IPOAH: ['self_occupied', 'in_same_council', 'completion_status'],
};

export type SectionField =
  | 'payment' | 'age_id' | 'medical_expenses' | 'dependent_disability' | 'disability_type'
  | 'self_occupied' | 'in_same_council' | 'completion_status';

/** Which fields a rule type uses (CI initForm / setFormValidationRules). */
export function ruleFieldsFor(code: RuleTypeCode) {
  return {
    component: code === 'BRTYSBR',
    section: code === 'BRTYIDR',
    /** CI: limits are optional for Flat Deduction Rules only. */
    limitsRequired: code !== 'BRTYFDR',
  };
}

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export type RuleValues = {
  tax_allowance_type: string;
  component_id: string;
  section_id: string;
  calculation_factor: string;
  month: string;
  dependent_on_component: string;
  self_occupied: boolean;
  in_same_council: boolean;
  completion_status: string;
  payment: string;
  age_id: string;
  medical_expenses: string;
  dependent_disability: string;
  disability_type: string;
  lower_limit: string;
  open_limit: boolean;
  is_disable: boolean;
  new_regime: boolean;
  upper_limit: string;
  values: string;
  sign_factor: string;
  gender: string;
  comment: string;
  financial_year: string;
  country: string;
};

export interface CodedOption extends IdLabel {
  code: string | null;
}

export interface RuleFormOptions {
  sections: CodedOption[];
  taxAllowanceTypes: IdLabel[];
  components: IdLabel[];
  calculationFactors: CodedOption[];
  completionStatuses: IdLabel[];
  payments: IdLabel[];
  ages: IdLabel[];
  medicalExpenses: IdLabel[];
  dependentDisabilities: IdLabel[];
  disabilityTypes: IdLabel[];
  signFactors: IdLabel[];
  genders: IdLabel[];
  financialYears: IdLabel[];
  countries: IdLabel[];
}

export interface RuleFormModel {
  code: RuleTypeCode;
  title: string;
  options: RuleFormOptions;
}

/** One list row: ids and the names CI's *_vw views showed. */
export interface RuleRow {
  id: number;
  ruleTypeCode: RuleTypeCode | null;
  component: string | null;
  section: string | null;
  calculationFactor: string | null;
  dependentOn: string | null;
  taxAllowanceType: string | null;
  lowerLimit: string | null;
  upperLimit: string | null;
  values: string | null;
  signFactor: string | null;
  openLimit: string;
  gender: string | null;
  month: string | null;
  age: string | null;
  expensesType: string | null;
  severeType: string | null;
  disabilityType: string | null;
  payment: string | null;
  financialYear: string | null;
  country: string | null;
  comment: string | null;
  brand: string | null;
}
