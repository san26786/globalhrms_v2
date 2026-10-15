-- org_accounts_vw — the list behind CI systmMngt/org_accounts ("Organisation").
--
-- The CI MySQL view was not migrated; rebuilt from its entity configuration (entity_obj_attrbt rows of
-- OBJ_NM = 'org_accounts_vw'): the organisation, its status code / name, its account type and the
-- creating / updating users. LIMIT 1 sub-queries because independent_mst / user_mst hold duplicated rows.
-- Reconstructed: confirm against the original (SHOW CREATE VIEW org_accounts_vw) if you have it.
--
-- Review, then run once:  psql "$DATABASE_URL" -f prisma/sql/views/org_accounts_vw.sql

BEGIN;

DROP VIEW IF EXISTS org_accounts_vw;

CREATE VIEW org_accounts_vw AS
SELECT
  o."OA_ID",
  o."OA_CD",
  o."OA_NM",
  o."OA_EMAIL",
  o."PARTNER_ID",
  o."OA_WEB_DOMAIN",
  o."OA_CONTACT_NO",
  o."OA_STATUS_ID",
  o."OA_ADDRESS",
  (SELECT im."MSTR_CD" FROM independent_mst im WHERE im."MSTR_ID" = o."OA_STATUS_ID" ORDER BY im."MSTR_ID" LIMIT 1) AS "OA_STATUS_CD",
  o."OA_ACC_TYPE",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = o."OA_STATUS_ID" ORDER BY im."MSTR_ID" LIMIT 1) AS "OA_STATUS_NM",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = o."OA_ACC_TYPE" ORDER BY im."MSTR_ID" LIMIT 1) AS "ACC_TYPE",
  o."CREATED_BY" AS "CREATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = o."CREATED_BY" LIMIT 1) AS "CREATED_BY_USER_NAME",
  o."UPDATED_BY" AS "UPDATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = o."UPDATED_BY" LIMIT 1) AS "UPDATED_BY_USER_NAME",
  o."CREATED_BY",
  o."UPDATED_BY",
  o."CREATED_ON",
  o."UPDATED_ON",
  o."IS_DELETED"
FROM org_accounts o;

COMMIT;
