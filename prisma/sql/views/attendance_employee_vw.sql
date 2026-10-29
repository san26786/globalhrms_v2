-- attendance_employee_vw — attendance employees with their employee code and name, manager,
-- status, organisation, brand and users. Used by the Attendance dashboard.
--
-- Ported from the original CI MySQL view (SHOW CREATE VIEW in the live dump, globalin_latest,
-- 2026-10-09). Same columns, names and order. Differences, all forced by PostgreSQL:
--   * MySQL let a sub-query use another column's alias (OAID, OABRANDID, USERID,
--     CREATED_BY_USER_ID, UPDATED_BY_USER_ID); here the underlying column is used instead.
--   * IS_MANAGER is text ("1", "0", "", "No"): "1" means Yes, as MySQL's `= 1` did.
--   * EMPLOYEE_NM stays empty when a name part is missing, as MySQL's CONCAT did.
--   * Look-ups take LIMIT 1, so a duplicated master row cannot make the whole view fail.
--
-- Review, then run once:  psql "$DATABASE_URL" -f prisma/sql/views/attendance_employee_vw.sql

BEGIN;

DROP VIEW IF EXISTS attendance_employee_vw;

CREATE VIEW attendance_employee_vw AS
SELECT
  ae."ATTND_EMP_ID",
  (SELECT e."EMP_NBR" FROM emp_mst e WHERE e."REF_EMP_ID" = ae."REF_EMP_ID" LIMIT 1) AS "REF_EMP_CD",
  ae."EMP_NM",
  CASE WHEN ae."IS_MANAGER" ~ '^\s*0*1(\.0*)?\s*$' THEN 'Yes' ELSE 'No' END AS "IS_MANAGER",
  ae."MANAGER_ID",
  (SELECT m."EMP_NM" FROM attendance_employee m WHERE m."ATTND_EMP_ID" = ae."MANAGER_ID" LIMIT 1) AS "MANAGER_NM",
  ae."REF_EMP_ID",
  (SELECT e."EMP_NAME" || ' ' || e."EMP_MIDDLE_NM" || ' ' || e."EMPLST_NM" FROM emp_mst e WHERE e."REF_EMP_ID" = ae."REF_EMP_ID" LIMIT 1) AS "EMPLOYEE_NM",
  (SELECT e."EMP_STATUS_ID" FROM emp_mst e WHERE e."REF_EMP_ID" = ae."REF_EMP_ID" LIMIT 1) AS "EMP_STATUS_ID",
  ae."IS_DELETED",
  ae."OA_ID" AS "OAID",
  (SELECT o."OA_CD" FROM org_accounts o WHERE o."OA_ID" = ae."OA_ID" LIMIT 1) AS "OA_CD",
  (SELECT o."OA_NM" FROM org_accounts o WHERE o."OA_ID" = ae."OA_ID" LIMIT 1) AS "OA_NM",
  ae."OA_BRAND_ID" AS "OABRANDID",
  (SELECT b."OA_BRAND_CD" FROM oa_brands b WHERE b."OA_BRAND_ID" = ae."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_CD",
  (SELECT b."OA_BRAND_NM" FROM oa_brands b WHERE b."OA_BRAND_ID" = ae."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_NM",
  ae."USER_ID" AS "USERID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = ae."USER_ID" LIMIT 1) AS "USER_NM",
  ae."CREATED_BY" AS "CREATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = ae."CREATED_BY" LIMIT 1) AS "CREATED_BY_USER_NAME",
  ae."UPDATED_BY" AS "UPDATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = ae."UPDATED_BY" LIMIT 1) AS "UPDATED_BY_USER_NAME",
  ae."CREATEDON",
  ae."UPDATEDON"
FROM attendance_employee ae;

COMMIT;
