export interface CommonType {
  TYP_ID: number;
  TYP_CD: string;
  TYP_NM: string;
  VIEW_NM: string | null;
  PARENT_TYP_ID: number | null;
  IS_EDITABLE: boolean | null;
  IS_PREDEFINED: boolean | null;
  TABLE_TYPE: string | null;
  VISIBLE_TO_USER_FLAG: number | null;
  USER_CAN_CREATE_DATA: number;
  ORIGINATING_MODULE: string | null;
  MODULE_SEQ: number | null;
  ORIGINATING_SYSTEM: string;
  IS_DELETED: boolean | null;
  OA_ID: number | null;
  OA_BRAND_ID: number | null;
  USER_ID: number | null;
  CREATED_BY: number | null;
  UPDATED_BY: number | null;
  CREATED_ON: Date | null;
  UPDATED_ON: Date | null;
  REPLICATE_DATA_FOR_ALL_BRANDS: number | null;
  APP_ID: number;
  APP_CD: string;
}