import type { IdLabel } from '@/lib/systmMngt/shared';

/**
 * The three exit-form letter setting screens (CI exit_form/*) and their data shapes — shared by the
 * pages and the API, no server imports. Service: ./letterSettings.
 */
export const LETTER_SCREENS = {
  experience_letter_setting: {
    menu: 'exit_form/experience_letter_setting',
    title: 'Experience Letter Setting',
    table: 'experience_letter_setting',
    primaryKey: 'EXPERIENCE_LETTER_SETTING_ID',
    templateColumn: 'EXPERIENCE_LETTER_TEMPLATE',
    templateCode: 'TPEXPLTRTMPL',
    templateLabel: 'Select Experience Letter Template',
  },
  relieving_order_setting: {
    menu: 'exit_form/relieving_order_setting',
    title: 'Relieving Order Setting',
    table: 'relieving_order_setting',
    primaryKey: 'RELIEVING_ORDER_SETTING_ID',
    templateColumn: 'RELIEVING_ORDER_TEMPLATE',
    templateCode: 'TPRLORDR',
    templateLabel: 'Select Relieving Order Template',
  },
  exit_form_setting: {
    menu: 'exit_form/exit_form_setting',
    title: 'Exit Form Setting',
    table: 'exit_form_setting',
    primaryKey: 'EXIT_FORM_SETTING_ID',
    templateColumn: 'EXIT_FORM_TEMPLATE',
    templateCode: 'TPSSLIP',
    templateLabel: 'Select Exit Form Template',
  },
} as const;

export type LetterScreenKey = keyof typeof LETTER_SCREENS;

type TextField =
  | 'prefix' | 'currency_id' | 'reg_address' | 'reg_address_2' | 'reg_address_3' | 'postal_code' | 'city' | 'country'
  | 'registration_no' | 'vat_no' | 'account_name' | 'account_no' | 'sort_code'
  | 'instruction_line_1' | 'instruction_line_2' | 'instruction_line_3' | 'instruction_line_4' | 'template';

export type LetterValues = Record<TextField, string> & { mail_pdf: boolean };

export interface LetterSettingsModel {
  title: string;
  mode: 'add' | 'edit';
  brand: { name: string; code: string; folder: string };
  values: LetterValues;
  options: { currencies: IdLabel[]; countries: IdLabel[]; templates: IdLabel[] };
  canSave: boolean;
}
