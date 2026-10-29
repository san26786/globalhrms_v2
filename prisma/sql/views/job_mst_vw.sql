-- job_mst_vw — every job row with its looked-up names: employee, status, type, department,
-- designation, cost centre, holiday group, title, category, band, grade, position, currency,
-- payment method, appraisal type, work location, salary basis, organisation, brand and users.
-- Used by the Employee dashboard (staff by department, joining trend by year).
--
-- Ported from the original CI MySQL view (SHOW CREATE VIEW in the live dump, globalin_latest,
-- 2026-10-09). Same columns, names and order (including the lower-case "position_id",
-- "currency_id" and "Created_By_User_id"). Differences, all forced by PostgreSQL:
--   * MySQL let a sub-query use another column's alias (EMPSTATUSID, OAID, OABRANDID, USERID,
--     Created_By_User_id, UPDATED_BY_USER_ID); here the underlying column is used instead.
--   * COST_CENTER and WORK_LOCATION are text columns holding ids. A whole-number value is
--     compared as that id; codes such as "GVI03" match nothing (MySQL read them as 0).
--   * EMP_NM stays empty when a name part is missing, as MySQL's CONCAT did.
--   * Look-ups take LIMIT 1, so a duplicated master row cannot make the whole view fail.
--
-- Review, then run once:  psql "$DATABASE_URL" -f prisma/sql/views/job_mst_vw.sql

BEGIN;

DROP VIEW IF EXISTS job_mst_vw;

CREATE VIEW job_mst_vw AS
SELECT
  jm."JOB_ID",
  jm."EMP_ID" AS "EMPLOYEE_ID",
  (SELECT e."EMP_NBR" FROM emp_mst e WHERE e."EMP_ID" = jm."EMP_ID" LIMIT 1) AS "EMP_NBR",
  (SELECT e."EMP_NAME" || ' ' || e."EMP_MIDDLE_NM" || ' ' || e."EMPLST_NM" FROM emp_mst e WHERE e."EMP_ID" = jm."EMP_ID" LIMIT 1) AS "EMP_NM",
  jm."EMP_STATUS_ID" AS "EMPSTATUSID",
  jm."EMP_GROSS_SALARY",
  jm."EMP_STATUS_ID",
  jm."EMP_TYPE_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = jm."EMP_STATUS_ID" LIMIT 1) AS "STATUS_NAME",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = jm."EMP_TYPE_ID" LIMIT 1) AS "TYPE_NAME",
  jm."EMP_CAT_ID",
  jm."DEPARTMENT_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = jm."DEPARTMENT_ID" LIMIT 1) AS "DEPARTMENT_NAME",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = jm."DESIGNATION_ID" LIMIT 1) AS "DESIGNATION_NAME",
  jm."COST_CENTER",
  (SELECT im."MSTR_NM" FROM independent_mst im
    WHERE im."MSTR_ID" = CASE WHEN jm."COST_CENTER" ~ '^\s*-?[0-9]+\s*$' THEN btrim(jm."COST_CENTER")::bigint END LIMIT 1) AS "COST_CENTER_NAME",
  jm."HOLIDAY_GRP_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = jm."HOLIDAY_GRP_ID" LIMIT 1) AS "HOLIDAY_GRP",
  jm."DESIGNATION_ID",
  jm."EMP_ID",
  jm."JOB_TITLE_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = jm."JOB_TITLE_ID" LIMIT 1) AS "JOB_TITLE",
  jm."JOB_CAT_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = jm."JOB_CAT_ID" LIMIT 1) AS "JOB_CATEGORY",
  jm."WORK_STATION",
  jm."EMP_BAND_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = jm."EMP_BAND_ID" LIMIT 1) AS "EMP_BAND",
  jm."EMP_GRADE_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = jm."EMP_GRADE_ID" LIMIT 1) AS "EMP_GRADE",
  jm."POSITION_ID" AS "position_id",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = jm."POSITION_ID" LIMIT 1) AS "POSTION_NM",
  jm."CURRENCY_ID" AS "currency_id",
  (SELECT cm."CURR_NAME" FROM currency_mst cm WHERE cm."CURR_ID" = jm."CURRENCY_ID" LIMIT 1) AS "CURRENCY_NM",
  jm."DATE_OF_JOINING",
  CASE WHEN jm."IS_REJOIN" = 0 THEN 'No' ELSE 'Yes' END AS "IS_REJOIN",
  CASE WHEN jm."NEW_REGIME" = false THEN 'No' ELSE 'Yes' END AS "NEW_REGIME",
  jm."PAYSLIP_PDF_PASSWORD",
  jm."PAYMENT_METHOD",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = jm."PAYMENT_METHOD" LIMIT 1) AS "PAYMENT_METHOD_NM",
  jm."BASIC_HOURLY",
  jm."MAX_HOURS_AGREED",
  jm."BASIC_DAILY",
  jm."BASIC_MONTHLY",
  jm."PAYROLL_START_DATE",
  jm."AUTO_PAY_NUMBER",
  jm."COMMITED_HOURS",
  jm."MEDICLAIM",
  jm."CREATED_BY" AS "Created_By_User_id",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = jm."CREATED_BY" LIMIT 1) AS "CREATED_BY_USER_NAME",
  jm."UPDATED_BY" AS "UPDATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = jm."UPDATED_BY" LIMIT 1) AS "UPDATED_BY_USER_NAME",
  jm."CREATED_ON",
  jm."UPDATED_ON",
  jm."OA_ID" AS "OAID",
  (SELECT o."OA_CD" FROM org_accounts o WHERE o."OA_ID" = jm."OA_ID" LIMIT 1) AS "OA_CD",
  (SELECT o."OA_NM" FROM org_accounts o WHERE o."OA_ID" = jm."OA_ID" LIMIT 1) AS "OA_NM",
  jm."OA_BRAND_ID" AS "OABRANDID",
  (SELECT b."OA_BRAND_NM" FROM oa_brands b WHERE b."OA_BRAND_ID" = jm."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_NM",
  jm."USER_ID" AS "USERID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = jm."USER_ID" LIMIT 1) AS "USER_NM",
  jm."IS_DELETED",
  jm."CONFIRMATION_DATE",
  jm."LAST_APPRAISAL_DATE",
  jm."APPRAISAL_TYPE",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = jm."APPRAISAL_TYPE" LIMIT 1) AS "APPRAISAL_TYPE_NM",
  (SELECT im."MSTR_NM" FROM independent_mst im
    WHERE im."MSTR_ID" = CASE WHEN jm."WORK_LOCATION" ~ '^\s*-?[0-9]+\s*$' THEN btrim(jm."WORK_LOCATION")::bigint END LIMIT 1) AS "WORK_LOCATION",
  jm."SALARY_CALC_BASIS",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = jm."SALARY_CALC_BASIS" LIMIT 1) AS "SALARY_CALC_BASIS_NM",
  (SELECT b."OA_BRAND_CD" FROM oa_brands b WHERE b."OA_BRAND_ID" = jm."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_CD",
  jm."ACHIEVEMENT_INFO"
FROM job_mst jm;

COMMIT;
