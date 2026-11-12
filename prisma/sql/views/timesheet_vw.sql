-- timesheet_vw / timesheet_employee_vw — the lists behind CI timesheet/timesheet ("Timesheet") and the
-- employee dropdowns of its form, Auto Generate and Delayed Timesheet Permission.
--
-- timesheet_vw: CI migration 167_ppw_timesheet_approve_copy plus DELAYED_COUNT (in the entity
-- metadata of timesheet_vw, added with delayed timesheets). Same column names as CI, so the entity
-- configuration (labels, order, list visibility) applies unchanged.
-- timesheet_employee_vw: the columns of its entity metadata. CI's definition was not in the
-- migrations; it is rebuilt from timesheet_employee + emp_mst (EMP_STATUS_ID: CI filtered the
-- dropdowns on "Current" employees) and the manager's name as APPROVER_NM.
--
-- independent_mst / org_accounts / oa_brands / user_mst / timesheet_employee hold duplicated rows
-- (migrated data): names come from LIMIT 1 sub-queries so each timesheet stays one row.
--
-- Review, then run once:  psql "$DATABASE_URL" -f prisma/sql/views/timesheet_vw.sql

BEGIN;

DROP VIEW IF EXISTS timesheet_vw;

CREATE VIEW timesheet_vw AS
SELECT
  t."TS_ID",
  t."TS_EMP_ID" AS "TSEMPID",
  (SELECT te."REF_EMP_ID" FROM timesheet_employee te WHERE te."TS_EMP_ID" = t."TS_EMP_ID" LIMIT 1) AS "EMP_ID",
  (SELECT em."EMP_STATUS_ID" FROM emp_mst em JOIN timesheet_employee te ON te."REF_EMP_ID" = em."REF_EMP_ID"
    WHERE te."TS_EMP_ID" = t."TS_EMP_ID" ORDER BY em."IS_DELETED", em."EMP_ID" DESC LIMIT 1) AS "EMP_STATUS_ID",
  (SELECT te."EMP_NM" FROM timesheet_employee te WHERE te."TS_EMP_ID" = t."TS_EMP_ID" LIMIT 1) AS "EMP_NM",
  t."PERIOD_ID",
  (SELECT p."FISCAL_PERIOD_DESC" FROM period_mst p WHERE p."PERIOD_ID" = t."PERIOD_ID" LIMIT 1) AS "FISCAL_DESC",
  t."TS_DATE",
  t."TS_START_DATE",
  t."TS_END_DATE",
  t."TS_STATUS_ID",
  (SELECT TRIM(im."MSTR_NM") FROM independent_mst im WHERE im."MSTR_ID" = t."TS_STATUS_ID" LIMIT 1) AS "STATUS_NM",
  t."APPROVER_ID",
  (SELECT CONCAT_WS(' ', NULLIF(em."EMP_NAME", ''), NULLIF(em."EMP_MIDDLE_NM", ''), NULLIF(em."EMPLST_NM", ''))
     FROM emp_mst em WHERE em."REF_EMP_ID" = t."APPROVER_ID" ORDER BY em."IS_DELETED", em."EMP_ID" DESC LIMIT 1) AS "APPROVER_NM",
  t."TOT_TS_DURATIONID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = t."TOT_TS_DURATIONID" LIMIT 1) AS "TOTAL_TS_DURATIONID",
  t."TOT_TS_DURATION" AS "TOTAL_TS_DURATION",
  t."DURATION_UNIT_ID" AS "TOT_ACTY_DURATIONID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = t."DURATION_UNIT_ID" LIMIT 1) AS "TOTAL_ACTY_DURATIONID",
  t."ACTIVITY_DURATION",
  t."TS_PRJ_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = t."TS_PRJ_ID" LIMIT 1) AS "PRJ_NM",
  t."TS_ACTIVITY_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = t."TS_ACTIVITY_ID" LIMIT 1) AS "TS_ACTIVITY_NM",
  t."COMMENT",
  t."APPR_CMNT" AS "APPROVER_COMMNET",
  t."APPROVED_FOR_COPY",
  t."DELAYED_COUNT",
  t."OA_ID" AS "OAID",
  (SELECT oa."OA_CD" FROM org_accounts oa WHERE oa."OA_ID" = t."OA_ID" LIMIT 1) AS "OA_CD",
  (SELECT oa."OA_NM" FROM org_accounts oa WHERE oa."OA_ID" = t."OA_ID" LIMIT 1) AS "OA_NM",
  t."OA_BRAND_ID" AS "OABRANDID",
  (SELECT b."OA_BRAND_CD" FROM oa_brands b WHERE b."OA_BRAND_ID" = t."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_CD",
  (SELECT b."OA_BRAND_NM" FROM oa_brands b WHERE b."OA_BRAND_ID" = t."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_NM",
  t."USER_ID" AS "USERID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = t."USER_ID" LIMIT 1) AS "USER_NM",
  t."CREATED_BY" AS "CREATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = t."CREATED_BY" LIMIT 1) AS "CREATED_BY_USER_NAME",
  t."UPDATED_BY" AS "UPDATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = t."UPDATED_BY" LIMIT 1) AS "UPDATED_BY_USER_NAME",
  t."CREATEDON" AS "CREATED_ON",
  t."UPDATEDON" AS "UPDATED_ON",
  t."IS_DELETED"
FROM timesheet t
WHERE t."IS_DELETED" = 0;

DROP VIEW IF EXISTS timesheet_employee_vw;

CREATE VIEW timesheet_employee_vw AS
SELECT
  te."TS_EMP_ID",
  te."REF_EMP_ID",
  te."REF_EMP_CD",
  te."EMP_NM",
  te."IS_MANAGER",
  te."MANAGER_ID",
  (SELECT em."EMP_STATUS_ID" FROM emp_mst em WHERE em."REF_EMP_ID" = te."REF_EMP_ID"
    ORDER BY em."IS_DELETED", em."EMP_ID" DESC LIMIT 1) AS "EMP_STATUS_ID",
  (SELECT m."EMP_NM" FROM timesheet_employee m WHERE m."TS_EMP_ID" = te."MANAGER_ID" LIMIT 1) AS "APPROVER_NM",
  te."OA_ID" AS "OAID",
  (SELECT oa."OA_CD" FROM org_accounts oa WHERE oa."OA_ID" = te."OA_ID" LIMIT 1) AS "OA_CD",
  (SELECT oa."OA_NM" FROM org_accounts oa WHERE oa."OA_ID" = te."OA_ID" LIMIT 1) AS "OA_NM",
  te."USER_ID" AS "USERID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = te."USER_ID" LIMIT 1) AS "USER_NM",
  te."OA_BRAND_ID" AS "OABRANDID",
  (SELECT b."OA_BRAND_CD" FROM oa_brands b WHERE b."OA_BRAND_ID" = te."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_CD",
  (SELECT b."OA_BRAND_NM" FROM oa_brands b WHERE b."OA_BRAND_ID" = te."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_NM",
  te."CREATED_BY" AS "CREATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = te."CREATED_BY" LIMIT 1) AS "CREATED_BY_USER_NAME",
  te."UPDATED_BY" AS "UPDATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = te."UPDATED_BY" LIMIT 1) AS "UPDATED_BY_USER_NAME",
  te."CREATEDON" AS "CREATED_ON",
  te."UPDATEDON" AS "UPDATED_ON",
  te."IS_DELETED"
FROM timesheet_employee te;

-- timesheet_item_vw: CI migration 168 (Timesheet Items list), names via LIMIT 1 sub-queries.
DROP VIEW IF EXISTS timesheet_item_vw;

CREATE VIEW timesheet_item_vw AS
SELECT
  ti."TS_ITEM_ID",
  ti."TS_ID",
  ti."TS_DATE",
  ti."START_TIME",
  ti."END_TIME",
  ti."DURATION",
  ti."DURATION_UNIT_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = ti."DURATION_UNIT_ID" LIMIT 1) AS "DURATION_UNIT",
  ti."COMMENT",
  ti."TS_PRJ_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = ti."TS_PRJ_ID" LIMIT 1) AS "PRJ_NM",
  ti."TS_ACTIVITY_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = ti."TS_ACTIVITY_ID" LIMIT 1) AS "TS_ACTIVITY_NM",
  ti."OA_ID" AS "OAID",
  (SELECT oa."OA_CD" FROM org_accounts oa WHERE oa."OA_ID" = ti."OA_ID" LIMIT 1) AS "OA_CD",
  (SELECT oa."OA_NM" FROM org_accounts oa WHERE oa."OA_ID" = ti."OA_ID" LIMIT 1) AS "OA_NM",
  ti."USER_ID" AS "USERID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = ti."USER_ID" LIMIT 1) AS "USER_NM",
  ti."OA_BRAND_ID" AS "OABRANDID",
  (SELECT b."OA_BRAND_CD" FROM oa_brands b WHERE b."OA_BRAND_ID" = ti."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_CD",
  (SELECT b."OA_BRAND_NM" FROM oa_brands b WHERE b."OA_BRAND_ID" = ti."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_NM",
  ti."CREATED_BY" AS "CREATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = ti."CREATED_BY" LIMIT 1) AS "CREATED_BY_USER_NAME",
  ti."UPDATED_BY" AS "UPDATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = ti."UPDATED_BY" LIMIT 1) AS "UPDATED_BY_USER_NAME",
  ti."CREATEDON" AS "CREATED_ON",
  ti."UPDATEDON" AS "UPDATED_ON",
  ti."IS_DELETED",
  ti."PERIOD_ID",
  ti."ITEM_STATUS",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = ti."ITEM_STATUS" LIMIT 1) AS "ITEM_STATUS_NM"
FROM timesheet_item ti;

-- user_project_details_vw: CI migration 352 plus UPD_ID / USER_NM / IS_ENABLED (entity metadata) —
-- every brand project (type TP) with each user's settings; a project nobody configured has USER_ID NULL.
DROP VIEW IF EXISTS user_project_details_vw;

CREATE VIEW user_project_details_vw AS
SELECT
  im."MSTR_ID" AS "PROJECT_ID",
  upd."UPD_ID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = upd."USER_ID" LIMIT 1) AS "USER_NM",
  im."MSTR_NM" AS "PROJECT_NM",
  upd."USER_ID",
  CASE WHEN COALESCE(upd."IS_DEFAULT", 0) = 0 THEN 'No' ELSE 'Yes' END AS "IS_DEFAULT",
  CASE WHEN COALESCE(upd."IS_CURRENT", 0) = 0 THEN 'No' ELSE 'Yes' END AS "IS_CURRENT",
  im."OA_ID",
  im."OA_BRAND_ID",
  CASE WHEN upd."UPD_ID" IS NULL OR upd."IS_ENABLED" = 1 THEN 'Yes' ELSE 'No' END AS "IS_ENABLED",
  CASE WHEN im."IS_DELETED" THEN 1 ELSE 0 END AS "IS_DELETED"
FROM independent_mst im
LEFT JOIN user_project_details upd ON upd."PROJECT_ID" = im."MSTR_ID" AND upd."IS_DELETED" = 0
WHERE im."TYP_ID" = (SELECT ct."TYP_ID" FROM common_type ct WHERE ct."TYP_CD" = 'TP' LIMIT 1);

COMMIT;
