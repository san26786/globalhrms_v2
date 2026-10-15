-- salary_component_settings_vw — the list behind CI systmMngt/salary_component_settings ("Salary Component").
--
-- The CI MySQL view was not migrated; rebuilt from its entity configuration (entity_obj_attrbt rows of
-- OBJ_NM = 'salary_component_settings_vw'). Names come from LIMIT 1 sub-queries because
-- independent_mst / org_accounts / oa_brands / user_mst hold duplicated rows.
-- IS_ANNUAL / OT_* / IS_ENABLED / VISIBLE_IN_* are 'Yes' / 'No' text (entity type varchar).
-- Reconstructed: confirm against the original (SHOW CREATE VIEW salary_component_settings_vw) if you have it.
--
-- Review, then run once:  psql "$DATABASE_URL" -f prisma/sql/views/salary_component_settings_vw.sql

BEGIN;

DROP VIEW IF EXISTS salary_component_settings_vw;

CREATE VIEW salary_component_settings_vw AS
SELECT
  s."SC_ID",
  s."COMPONENT_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = s."COMPONENT_ID" ORDER BY im."MSTR_ID" LIMIT 1) AS "SALARY_COMPONENT",
  s."COMPONENT_SEQUENCE",
  s."COMPONENT_TYPE",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = s."COMPONENT_TYPE" ORDER BY im."MSTR_ID" LIMIT 1) AS "COMPONENT_TYPE_NM",
  s."PAY_GROUP_HEAD",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = s."PAY_GROUP_HEAD" ORDER BY im."MSTR_ID" LIMIT 1) AS "PAY_GROUP_HEAD_NM",
  s."PAYROLL_COMP_CALC_TYPE",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = s."PAYROLL_COMP_CALC_TYPE" ORDER BY im."MSTR_ID" LIMIT 1) AS "PAYROLL_COMP_CALC_TYPE_NM",
  s."COMPONENT_CALC_TYPE",
  s."COMPONENT_CALC_TYPE_CONFIG",
  CASE WHEN s."IS_ANNUAL" = 1 THEN 'Yes' ELSE 'No' END AS "IS_ANNUAL",
  s."SIGN",
  s."TAXABLE_STATUS",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = s."TAXABLE_STATUS" ORDER BY im."MSTR_ID" LIMIT 1) AS "TAXABLE_STATUS_NM",
  CASE WHEN s."OT_APPLICABLE" = 1 THEN 'Yes' ELSE 'No' END AS "OT_APPLICABLE",
  CASE WHEN s."OT_INCLUDED" = 1 THEN 'Yes' ELSE 'No' END AS "OT_INCLUDED",
  s."EFFECTIVE_FROM",
  s."LATEST_CALCULATED",
  CASE WHEN s."IS_ENABLED" = 1 THEN 'Yes' ELSE 'No' END AS "IS_ENABLED",
  CASE WHEN s."VISIBLE_IN_SALARY" = 1 THEN 'Yes' ELSE 'No' END AS "VISIBLE_IN_SALARY",
  CASE WHEN s."VISIBLE_IN_ANNEXURE" = 1 THEN 'Yes' ELSE 'No' END AS "VISIBLE_IN_ANNEXURE",
  s."OA_ID" AS "OAID",
  (SELECT o."OA_CD" FROM org_accounts o WHERE o."OA_ID" = s."OA_ID" LIMIT 1) AS "OA_CD",
  (SELECT o."OA_NM" FROM org_accounts o WHERE o."OA_ID" = s."OA_ID" LIMIT 1) AS "OA_NM",
  s."OA_BRAND_ID" AS "OABRANDID",
  (SELECT b."OA_BRAND_CD" FROM oa_brands b WHERE b."OA_BRAND_ID" = s."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_CD",
  (SELECT b."OA_BRAND_NM" FROM oa_brands b WHERE b."OA_BRAND_ID" = s."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_NM",
  s."USER_ID" AS "USERID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = s."USER_ID" LIMIT 1) AS "USER_NM",
  s."IS_DELETED",
  s."CREATED_BY" AS "CREATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = s."CREATED_BY" LIMIT 1) AS "CREATED_BY_USER_NAME",
  s."UPDATED_BY" AS "UPDATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = s."UPDATED_BY" LIMIT 1) AS "UPDATED_BY_USER_NAME",
  s."CREATED_ON",
  s."UPDATED_ON"
FROM salary_component_settings s;

COMMIT;
