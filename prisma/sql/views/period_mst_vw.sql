-- period_mst_vw — the list behind CI periodMngt/period_mst ("Period Master").
--
-- The CI MySQL view was not migrated and its definition is not in the CI source. This is rebuilt
-- from the view's entity configuration (entity_obj_attrbt rows of OBJ_NM = 'period_mst_vw'), which
-- lists exactly these columns. Names come from scalar sub-queries with LIMIT 1 because
-- independent_mst, org_accounts, oa_brands and user_mst hold duplicated rows (a plain JOIN would
-- list a period several times, and a sub-query without LIMIT 1 aborts the list).
--
-- IS_VERIFIED / IS_LOCKED are 'Yes' / 'No' text (entity type varchar): CI's row action
-- "Verify" is shown only when IS_VERIFIED = 'No'. Reconstructed: confirm against the original MySQL
-- view (SHOW CREATE VIEW period_mst_vw) if you have it.
--
-- Review, then run once:  psql "$DATABASE_URL" -f prisma/sql/views/period_mst_vw.sql

BEGIN;

DROP VIEW IF EXISTS period_mst_vw;

CREATE VIEW period_mst_vw AS
SELECT
  p."PERIOD_ID",
  p."PERIOD_TYPE_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = p."PERIOD_TYPE_ID" ORDER BY im."MSTR_ID" LIMIT 1) AS "PERIOD_TYP",
  (SELECT im."MSTR_CD" FROM independent_mst im WHERE im."MSTR_ID" = p."PERIOD_TYPE_ID" ORDER BY im."MSTR_ID" LIMIT 1) AS "PERIOD_TYP_CD",
  p."PERIOD_START_DATE",
  p."PERIOD_END_DATE",
  p."FISCAL_PERIOD_DESC",
  p."PERIOD_STATUS_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = p."PERIOD_STATUS_ID" ORDER BY im."MSTR_ID" LIMIT 1) AS "PERIOD_STATUS",
  (SELECT im."MSTR_CD" FROM independent_mst im WHERE im."MSTR_ID" = p."PERIOD_STATUS_ID" ORDER BY im."MSTR_ID" LIMIT 1) AS "PERIOD_STATUS_CD",
  CASE WHEN p."IS_VERIFIED" THEN 'Yes' ELSE 'No' END AS "IS_VERIFIED",
  CASE WHEN p."IS_LOCKED" = 1 THEN 'Yes' ELSE 'No' END AS "IS_LOCKED",
  p."OA_ID" AS "OAID",
  (SELECT o."OA_CD" FROM org_accounts o WHERE o."OA_ID" = p."OA_ID" LIMIT 1) AS "OA_CD",
  (SELECT o."OA_NM" FROM org_accounts o WHERE o."OA_ID" = p."OA_ID" LIMIT 1) AS "OA_NM",
  p."USER_ID" AS "USERID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = p."USER_ID" LIMIT 1) AS "USER_NM",
  p."OA_BRAND_ID" AS "OABRANDID",
  (SELECT b."OA_BRAND_CD" FROM oa_brands b WHERE b."OA_BRAND_ID" = p."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_CD",
  (SELECT b."OA_BRAND_NM" FROM oa_brands b WHERE b."OA_BRAND_ID" = p."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_NM",
  p."CREATED_BY" AS "CREATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = p."CREATED_BY" LIMIT 1) AS "CREATED_BY_USER_NAME",
  p."UPDATED_BY" AS "UPDATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = p."UPDATED_BY" LIMIT 1) AS "UPDATED_BY_USER_NAME",
  p."CREATED_ON",
  p."UPDATED_ON",
  p."IS_DELETED"
FROM period_mst p;

COMMIT;
