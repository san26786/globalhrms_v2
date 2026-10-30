import type { IdLabel } from '@/lib/systmMngt/shared';

/**
 * CI organisation/invoice_setting/getSpecificSetting/{settingId} screens on the Advance Settings menu,
 * and their data shapes — shared by the page and the API, no server imports. Service: ./orderSettings.
 * `settingId` is the record's TEMPLATE_SETTING_ID (one record per brand and setting); the template
 * list is inv_template_mst of `templateType`, and the chosen template is read from `templateColumn`.
 */
export const ORDER_SCREENS = {
  '5569': {
    menu: 'organisation/invoice_setting/getSpecificSetting/5569',
    title: 'Purchase Order Setting',
    prefixLabel: 'Purchase Order Prefix',
    templateLabel: 'Select Purchase Order Template',
    templateType: '5581',
    templateColumn: 'PURCHASE_ORDER_TEMPLATE',
    /** CI syncSetting $templates_cd: the template type code whose first template Sync applies. */
    syncTemplateCode: 'TPOT',
  },
  '5570': {
    menu: 'organisation/invoice_setting/getSpecificSetting/5570',
    title: 'Sales Order Setting',
    prefixLabel: 'Sales Order Prefix',
    templateLabel: 'Select Sales Order Template',
    templateType: '51443',
    templateColumn: 'SALES_ORDER_TEMPLATE',
    syncTemplateCode: 'SOT',
  },
} as const;

export type OrderSettingId = keyof typeof ORDER_SCREENS;

export function isOrderSettingId(value: string | null | undefined): value is OrderSettingId {
  return !!value && Object.prototype.hasOwnProperty.call(ORDER_SCREENS, value);
}

/** CI's India-only fields (brand country = India, independent_mst 216). */
export const APPLICABLE_TAXES = [
  { key: 'vat_applicable', label: 'Vat Applicable' },
  { key: 'service_tax_applicable', label: 'Service Tax Applicable' },
  { key: 'gst_applicable', label: 'GST Applicable' },
  { key: 'octroi_applicable', label: 'Octroi Applicable' },
] as const;

export type ApplicableTax = (typeof APPLICABLE_TAXES)[number]['key'];

type TextField =
  | 'org_currency_id' | 'reg_address' | 'reg_address_2' | 'reg_address_3' | 'city' | 'country' | 'postal_code'
  | 'registration_no' | 'food_license' | 'vat_no' | 'cst' | 'pan' | 'invoice_prefix' | 'bank_name' | 'account_name'
  | 'account_no' | 'sort_code' | 'ifsc_code' | 'instruction_line_1' | 'instruction_line_2' | 'instruction_line_3'
  | 'instruction_line_4' | 'org_template';

export type OrderValues = Record<TextField, string> & { mail_pdf: boolean } & Record<ApplicableTax, boolean>;

export interface TemplateOption {
  /** CI stored the template's image file name (TEMPLATE_IMAGE), not its id. */
  value: string;
  label: string;
}

export interface OrderSettingsModel {
  settingId: OrderSettingId;
  title: string;
  mode: 'add' | 'edit';
  brand: { name: string; code: string; folder: string };
  isIndia: boolean;
  values: OrderValues;
  options: { currencies: IdLabel[]; countries: IdLabel[]; templates: TemplateOption[] };
  canSave: boolean;
  /** CI "Sync Setting" (brand admins): copy the brand's Invoice Setting into this one. */
  canSync: boolean;
}
