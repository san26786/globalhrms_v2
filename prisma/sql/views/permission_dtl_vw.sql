-- permission_dtl_vw — the list behind CI user/permission_dtl ("Permission Details").
--
-- The CI MySQL view was not migrated and its definition is not in the CI source. This is rebuilt
-- from the view's entity configuration (entity_obj_attrbt rows of OBJ_NM = 'permission_dtl_vw'),
-- which lists exactly these columns. Names come from scalar sub-queries because independent_mst
-- holds duplicated master rows, and org_accounts / oa_brands duplicated rows too (plain JOINs
-- returned 238,220 rows for 190,472 permission rows).
--
-- USER_GRP_NM: the name of the referenced user / user group / role / function, by ref type
-- (PRTUP 65 / PRTGP 64 / PRTRP 66 / FUNP 1614). Reconstructed: confirm against the original
-- MySQL view (SHOW CREATE VIEW permission_dtl_vw) if you have it.
--
-- Every sub-query MUST keep its LIMIT 1: without it PostgreSQL aborts the list with "more than one
-- row returned by a subquery used as an expression" (duplicated masters / users / brands).
--
-- Review, then run once:  psql "$DATABASE_URL" -f prisma/sql/views/permission_dtl_vw.sql
-- (Drop + create: CREATE OR REPLACE cannot change a column's type, and an earlier version may exist.)

BEGIN;

DROP VIEW IF EXISTS permission_dtl_vw;

CREATE VIEW permission_dtl_vw AS
SELECT
  pd."PERMISSIONS_DTL_ID",
  pd."PERMISSIONS_CLASS_ID",
  (SELECT im."MSTR_CD" FROM independent_mst im WHERE im."MSTR_ID" = pd."PERMISSIONS_CLASS_ID" ORDER BY im."MSTR_ID" LIMIT 1) AS "PERMISSIONS_CLASS_CD",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = pd."PERMISSIONS_CLASS_ID" ORDER BY im."MSTR_ID" LIMIT 1) AS "PERMISSIONS_CLASS_NAME",
  pd."PERMISSIONS_REF_TYPE_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = pd."PERMISSIONS_REF_TYPE_ID" ORDER BY im."MSTR_ID" LIMIT 1) AS "TYP_NM",
  pd."PERMISSIONS_REF_ID",
  CASE pd."PERMISSIONS_REF_TYPE_ID"
    WHEN 64 THEN (SELECT g."USER_GRP_NM" FROM user_group g WHERE g."USER_GRP_ID" = pd."PERMISSIONS_REF_ID" LIMIT 1)
    WHEN 65 THEN (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = pd."PERMISSIONS_REF_ID" LIMIT 1)
    WHEN 66 THEN (SELECT r."ROLE_NM" FROM role_mst r WHERE r."ROLE_ID" = pd."PERMISSIONS_REF_ID" LIMIT 1)
    WHEN 1614 THEN (
      SELECT im."MSTR_NM"
      FROM relationship_dtl_vw rd
      JOIN config_mapping_dtl cm ON cm."SRC_ENTTY_ID" = rd."CHILD_MSTR_ID"
      JOIN independent_mst im ON im."MSTR_ID" = cm."TRGT_ENTTY_ID"
      WHERE rd."REL_DET_ID" = pd."PERMISSIONS_REF_ID"
      LIMIT 1)
  END AS "USER_GRP_NM",
  pd."OA_ID" AS "ORG_ACC_ID",
  (SELECT oa."OA_CD" FROM org_accounts oa WHERE oa."OA_ID" = pd."OA_ID" LIMIT 1) AS "OA_CD",
  (SELECT oa."OA_NM" FROM org_accounts oa WHERE oa."OA_ID" = pd."OA_ID" LIMIT 1) AS "OA_NM",
  pd."OA_BRAND_ID" AS "BRAND_ID",
  (SELECT b."OA_BRAND_CD" FROM oa_brands b WHERE b."OA_BRAND_ID" = pd."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_CD",
  (SELECT b."OA_BRAND_NM" FROM oa_brands b WHERE b."OA_BRAND_ID" = pd."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_NM",
  pd."USER_ID" AS "USERID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = pd."USER_ID" LIMIT 1) AS "USER_NM",
  pd."CREATED_BY" AS "CREATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = pd."CREATED_BY" LIMIT 1) AS "CREATED_BY_USER_NAME",
  pd."UPDATED_BY" AS "UPDATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = pd."UPDATED_BY" LIMIT 1) AS "UPDATED_BY_USER_NAME",
  pd."CREATED_ON",
  pd."UPDATED_ON",
  pd."IS_DELETED"
FROM permission_dtl pd;

COMMIT;
