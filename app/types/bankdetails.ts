export interface BankDetails {
  BANK_ID: number;
  BANK_NAME: string | null;
  BANK_ACC_TYPE: number | null;
  ACCOUNT_NM: string | null;
  ACCOUNT_NO: string | null;
  ADDRESS: string | null;
  IFSC_CD: string | null;
  BRANCH_NM: string | null;
  BRANCH_CD: string | null;
  MICR_CD: string | null;
  MSTR_ID: number | null;
  ACC_GROUP: string | null;
  SUBACC_GROUP: string | null;
  OPENING_BAL: string | null;
  DEPOSITS: string | null;
  WITHDRAWALS: string | null;
  OA_ID: number | null;
  OA_BRAND_ID: number | null;
  USER_ID: number | null;
  IS_DELETED: number | null;
  CREATED_BY: number | null;
  UPDATED_BY: number | null;
  CREATED_ON: Date | string | null;
  UPDATED_ON: Date | string | null;
}
