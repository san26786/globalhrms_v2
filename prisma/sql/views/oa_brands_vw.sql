-- oa_brands_vw — the list behind CI systmMngt/oa_brands ("Oa Brands"), also read by CI's export.
--
-- The CI MySQL view was not migrated; rebuilt from its entity configuration (entity_obj_attrbt rows of
-- OBJ_NM = 'oa_brands_vw', 60 attributes). oa_brands stores every row twice (identical copies), hence
-- DISTINCT ON; names come from LIMIT 1 sub-queries because independent_mst / org_accounts / user_mst
-- hold duplicated rows too. CONTACT is exposed as CONTACT_NAME, OA_ID also as ORG_ACC_ID (CI names).
-- Reconstructed: confirm against the original (SHOW CREATE VIEW oa_brands_vw) if you have it.
--
-- Review, then run once:  psql "$DATABASE_URL" -f prisma/sql/views/oa_brands_vw.sql

BEGIN;

DROP VIEW IF EXISTS oa_brands_vw;

CREATE VIEW oa_brands_vw AS
SELECT DISTINCT ON (b."OA_BRAND_ID")
  b."OA_BRAND_CD",
  b."OA_BRAND_NM",
  b."TELEPHONE",
  b."EMAIL",
  b."START_DATE",
  b."CESSATION_DATE",
  b."CONTACT" AS "CONTACT_NAME",
  b."ADDRESS",
  b."BANK_NAME",
  b."BRANCH_NAME",
  b."ACCOUNT_NAME",
  b."ACCOUNT_NO",
  b."SORT_CODE",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = b."COMPANY_TYPE" LIMIT 1) AS "COMPANY_TYPE_NM",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = b."country" LIMIT 1) AS "COUNTRY_NM",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = b."BUSINESS_CATEGORY" LIMIT 1) AS "BUSINESS_CATEGORY_NM",
  b."BUSINESS_DESC",
  CASE WHEN b."IS_ACTIVE" THEN 'Yes' ELSE 'No' END AS "IS_ACTIVE",
  (SELECT c."CURR_NAME" FROM currency_mst c WHERE c."CURR_ID" = b."CURRENCY_ID" LIMIT 1) AS "CURRENCY_ID_NM",
  CASE WHEN b."IS_PRIMARY" THEN 'Yes' ELSE 'No' END AS "IS_PRIMARY",
  b."OA_BRAND_ID",
  b."OA_ID",
  b."OA_ID" AS "ORG_ACC_ID",
  (SELECT o."OA_CD" FROM org_accounts o WHERE o."OA_ID" = b."OA_ID" LIMIT 1) AS "OA_CD",
  (SELECT o."OA_NM" FROM org_accounts o WHERE o."OA_ID" = b."OA_ID" LIMIT 1) AS "OA_NM",
  b."COMPANY_TYPE",
  b."REF_ID",
  b."PAYE_DISTRICT",
  b."BUSINESS_CATEGORY",
  b."TAX_OFFICE_TELEPHONE",
  b."PAYE_OFFICE_NO",
  b."PAYE_REFRENCE",
  b."ACCOUNTS_OFFICE_REFERENCE",
  b."CURRENCY_ID",
  b."UNIQUE_TAX_REFERENCE",
  b."CORPORATION_TAX_REFERENCE",
  b."TAX_OFFICE_ADDRESS",
  b."PAYROLL_GIVING_REFERENCE",
  b."SER_QUALIFIED",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = b."TAX_PAYMENT_METHOD" LIMIT 1) AS "TAX_PAYMENT_METHOD",
  b."AFFILIATED_BY",
  b."AFFILIATION_NO",
  b."BOARD",
  b."TAX_PAYMENT_METHOD" AS "TAX_PAYMENT_METHOD_ID",
  b."PAYMENT_REFERENCE",
  b."BUILDING_SOCIETY_REFRENCE",
  b."BANK_ADDRESS",
  b."BANK_LEAD_TIME",
  b."OA_BRAND_LOGO",
  b."BANK_TELEPHONE",
  b."OA_BRAND_INV_TMPLT",
  b."country" AS "COUNTRY",
  b."CREATED_BY" AS "CREATED_BY_USER_ID",
  b."UPDATED_BY" AS "UPDATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = b."CREATED_BY" LIMIT 1) AS "CREATED_BY_USER_NAME",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = b."UPDATED_BY" LIMIT 1) AS "UPDATED_BY_USER_NAME",
  b."BRAND_URL",
  b."UPDATED_ON",
  b."CREATED_ON",
  b."IS_DELETED"
FROM oa_brands b
ORDER BY b."OA_BRAND_ID";

COMMIT;
