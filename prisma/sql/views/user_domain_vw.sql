-- user_domain_vw — the list behind CI user/user_domain ("User Domain").
--
-- Same columns as the view already in the database; only the joins change. oa_brands /
-- org_accounts / user_mst hold duplicated rows (migrated data), so plain LEFT JOINs listed every
-- domain once per copy — names now come from LIMIT 1 sub-queries and each domain is one row.
-- CI names: OA_ID as ORG_ACC_ID, OA_BRAND_ID as BRAND_ID, USER_ID as USERID.
--
-- Review, then run once:  psql "$DATABASE_URL" -f prisma/sql/views/user_domain_vw.sql

BEGIN;

DROP VIEW IF EXISTS user_domain_vw;

CREATE VIEW user_domain_vw AS
SELECT
  ud."DMN_ID",
  ud."DMN_NM",
  ud."DSCRPTN",
  ud."OA_ID" AS "ORG_ACC_ID",
  (SELECT oa."OA_CD" FROM org_accounts oa WHERE oa."OA_ID" = ud."OA_ID" LIMIT 1) AS "OA_CD",
  (SELECT oa."OA_NM" FROM org_accounts oa WHERE oa."OA_ID" = ud."OA_ID" LIMIT 1) AS "OA_NM",
  ud."OA_BRAND_ID" AS "BRAND_ID",
  (SELECT b."OA_BRAND_CD" FROM oa_brands b WHERE b."OA_BRAND_ID" = ud."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_CD",
  (SELECT b."OA_BRAND_NM" FROM oa_brands b WHERE b."OA_BRAND_ID" = ud."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_NM",
  ud."USER_ID" AS "USERID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = ud."USER_ID" LIMIT 1) AS "USER_NM",
  ud."IS_DELETED",
  ud."CREATED_BY" AS "CREATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = ud."CREATED_BY" LIMIT 1) AS "CREATED_BY_USER_NAME",
  ud."UPDATED_BY" AS "UPDATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = ud."UPDATED_BY" LIMIT 1) AS "UPDATED_BY_USER_NAME",
  ud."CREATED_ON",
  ud."UPDATED_ON"
FROM user_domain ud;

COMMIT;
