-- oa_brand_settings_vw — the list behind CI systmMngt/oa_brand_settings ("Company Settings" and, with
-- /ATTR, the oa_brands tab "Company Attributes").
--
-- The CI MySQL view was not migrated; rebuilt from its entity configuration (entity_obj_attrbt rows of
-- OBJ_NM = 'oa_brand_settings_vw'). oa_brand_settings holds every row twice (identical copies), hence the
-- DISTINCT; names come from LIMIT 1 sub-queries because independent_mst / oa_brands / user_mst hold
-- duplicated rows too. The setting value's name comes from oa_settings_value_mst when the value is a
-- picked option (IS_CUSTOM = 0 and numeric), otherwise the value itself is the text.
-- Reconstructed: confirm against the original (SHOW CREATE VIEW oa_brand_settings_vw) if you have it.
--
-- Review, then run once:  psql "$DATABASE_URL" -f prisma/sql/views/oa_brand_settings_vw.sql

BEGIN;

DROP VIEW IF EXISTS oa_brand_settings_vw;

CREATE VIEW oa_brand_settings_vw AS
SELECT
  s."OAB_SETTING_ID",
  s."OABS_ATTRBUTE_ID",
  s."COMPANY_ATTRIBUTE",
  (SELECT im."MSTR_CD" FROM independent_mst im WHERE im."MSTR_ID" = s."OABS_ATTRBUTE_ID" ORDER BY im."MSTR_ID" LIMIT 1) AS "OABS_ATTRBUTE_CD",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = s."OABS_ATTRBUTE_ID" ORDER BY im."MSTR_ID" LIMIT 1) AS "OABS_ATTRBUTE_NM",
  sv."SETTING_VALUE_ID" AS "OABS_SETTING_VALUE_ID",
  sv."SETTING_VALUE_CD" AS "OABS_SETTING_VALUE_CD",
  COALESCE(sv."SEETTING_VALUE_NM", s."OABS_SETTING_VALUE") AS "OABS_SETTING_VALUE_NM",
  s."REF_ID",
  s."OABS_SETTING_VALUE",
  s."OA_BRAND_ID" AS "BRAND_ID",
  s."OA_BRAND_ID",
  (SELECT b."OA_BRAND_NM" FROM oa_brands b WHERE b."OA_BRAND_ID" = s."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_NM",
  (SELECT b."OA_BRAND_CD" FROM oa_brands b WHERE b."OA_BRAND_ID" = s."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_CD",
  COALESCE(sv."SEETTING_VALUE_NM", s."OABS_SETTING_VALUE") AS "OABS_SETTING_VALUE_NAME",
  s."DESCRIPTION",
  s."VALIDATION",
  CASE WHEN s."IS_ACTIVE" THEN 'Yes' ELSE 'No' END AS "IS_ACTIVE",
  s."CREATED_BY" AS "CREATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = s."CREATED_BY" LIMIT 1) AS "CREATED_BY_USER_NAME",
  s."UPDATED_BY" AS "UPDATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = s."UPDATED_BY" LIMIT 1) AS "UPDATED_BY_USER_NAME",
  s."CREATED_ON",
  s."UPDATED_ON",
  s."IS_DELETED"
FROM (SELECT DISTINCT * FROM oa_brand_settings) s
LEFT JOIN oa_settings_value_mst sv
  ON COALESCE(s."IS_CUSTOM", 0) = 0
 AND sv."SETTING_VALUE_ID" = CASE WHEN s."OABS_SETTING_VALUE" ~ '^[0-9]{1,9}$' THEN s."OABS_SETTING_VALUE"::int END;

COMMIT;
