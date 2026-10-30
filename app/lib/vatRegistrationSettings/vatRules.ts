import type { IdLabel } from '@/lib/systmMngt/shared';

/**
 * VAT Registration Settings rules shared by the form and the API (no server imports): which fields a
 * VAT status uses, and the screen's data shapes. Service: ./vatRegistrationSettings.
 */

export const VAT_STATUS = {
  applied: 'VARGSTRAF',
  registered: 'VARGSTR',
  deregistered: 'VARGSTDR',
  notRegistered: 'VARGSTNR',
} as const;

/** Which fields a VAT status keeps (CI setFormControls) — the same ones are required (setFormValidationRules). */
export function vatFieldsFor(status: string) {
  const registered = status === VAT_STATUS.registered || status === VAT_STATUS.deregistered;
  return {
    effectiveDate: registered || status === VAT_STATUS.applied,
    registration: registered,
    deregisterDate: status === VAT_STATUS.deregistered,
  };
}

export type VatValues = {
  vat_registered: string;
  registration_no: string;
  trade_in_eu: boolean;
  register_effective_date: string;
  first_vat_return: string;
  deregister_effective_date: string;
  return_frequency: string;
  accounting_basis: string;
  is_flat_rate: boolean;
  flat_rate_scheme: string;
  inc_pre_reg_expeneses: string;
};

export interface CodeLabel {
  value: string;
  label: string;
}

export interface VatOptions {
  statuses: CodeLabel[];
  returnFrequencies: IdLabel[];
  accountingBases: IdLabel[];
  preRegExpenses: IdLabel[];
  flatRateSchemes: IdLabel[];
}

export interface VatRegistrationModel {
  title: string;
  mode: 'add' | 'edit';
  values: VatValues;
  options: VatOptions;
  canSave: boolean;
}
