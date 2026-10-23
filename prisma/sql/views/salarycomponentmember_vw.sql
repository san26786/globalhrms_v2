-- salarycomponentmember_vw — the list behind CI salaryComponentMember/salarycomponentmember ("Component Member").
--
-- Same columns as the migrated view (entity_obj_attrbt rows of OBJ_NM = 'salarycomponentmember_vw'), but
-- names come from LIMIT 1 sub-queries: independent_mst / org_accounts / oa_brands / user_mst hold
-- duplicated rows, and the migrated LEFT JOINs listed every member once per duplicate.
-- IS_ENABLED is 'Yes' / 'No' text, as in salary_component_settings_vw.
--
-- Review, then run once:  psql "$DATABASE_URL" -f prisma/sql/views/salarycomponentmember_vw.sql

BEGIN;

DROP VIEW IF EXISTS salarycomponentmember_vw;

CREATE VIEW salarycomponentmember_vw AS
SELECT
  scm."SALARY_COMP_MEMBER_ID",
  scm."TYPE_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = scm."TYPE_ID" ORDER BY im."MSTR_ID" LIMIT 1) AS "TYPE",
  scm."COMPONENT_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = scm."COMPONENT_ID" ORDER BY im."MSTR_ID" LIMIT 1) AS "COMPONENT",
  scm."COMPONENT_MEMBER_CAL_SEQ",
  scm."COMPONENT_TYPE_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = scm."COMPONENT_TYPE_ID" ORDER BY im."MSTR_ID" LIMIT 1) AS "COMPONENT_TYPE",
  CASE WHEN scm."IS_ENABLED" = 1 THEN 'Yes' ELSE 'No' END AS "IS_ENABLED",
  scm."OA_ID" AS "OAID",
  (SELECT o."OA_CD" FROM org_accounts o WHERE o."OA_ID" = scm."OA_ID" LIMIT 1) AS "OA_CD",
  (SELECT o."OA_NM" FROM org_accounts o WHERE o."OA_ID" = scm."OA_ID" LIMIT 1) AS "OA_NM",
  scm."OA_BRAND_ID" AS "OABRANDID",
  (SELECT b."OA_BRAND_CD" FROM oa_brands b WHERE b."OA_BRAND_ID" = scm."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_CD",
  (SELECT b."OA_BRAND_NM" FROM oa_brands b WHERE b."OA_BRAND_ID" = scm."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_NM",
  scm."USER_ID" AS "USERID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = scm."USER_ID" LIMIT 1) AS "USER_NM",
  scm."IS_DELETED",
  scm."CREATED_BY" AS "CREATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = scm."CREATED_BY" LIMIT 1) AS "CREATED_BY_USER_NAME",
  scm."UPDATED_BY" AS "UPDATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = scm."UPDATED_BY" LIMIT 1) AS "UPDATED_BY_USER_NAME",
  scm."CREATED_ON",
  scm."UPDATE_ON"
FROM salarycomponentmember scm;

COMMIT;
