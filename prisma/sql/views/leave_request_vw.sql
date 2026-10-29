-- leave_request_vw — leave requests (not deleted) with their looked-up names: leave type, period,
-- employee, status, approver, organisation, brand and users.
-- leave_request_pending_vw — the same rows, pending only (status code LEPE).
-- Both are used by the Leave and Employee dashboards. They live in one file because the pending
-- view is built on leave_request_vw, so the two are dropped and created together.
--
-- Ported from the original CI MySQL views (SHOW CREATE VIEW in the live dump, globalin_latest,
-- 2026-10-09). Same columns, names and order (including "Created_On" / "Updated_On"). Differences,
-- all forced by PostgreSQL:
--   * MySQL let a sub-query use another column's alias (LEAVEPERIODID, LEAVEEMPID, OAID,
--     OABRANDID, USERID, CREATED_BY_USER_ID, UPDATED_BY_USER_ID); the underlying column is used.
--   * HALF_DAY is a true/false column here: true is "Yes", anything else "No", as before.
--   * Look-ups take LIMIT 1, so a duplicated master row cannot make the whole view fail.
--
-- Review, then run once:  psql "$DATABASE_URL" -f prisma/sql/views/leave_request_vw.sql

BEGIN;

DROP VIEW IF EXISTS leave_request_pending_vw;
DROP VIEW IF EXISTS leave_request_vw;

CREATE VIEW leave_request_vw AS
SELECT
  lr."LEAVE_REQUEST_ID",
  lr."LEAVE_TYPE_ID",
  (SELECT im."MSTR_CD" FROM independent_mst im WHERE im."MSTR_ID" = lr."LEAVE_TYPE_ID" LIMIT 1) AS "LEAVE_TYP_CD",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = lr."LEAVE_TYPE_ID" LIMIT 1) AS "LEAVE_TYP",
  lr."LEAVE_PERIOD_ID" AS "LEAVEPERIODID",
  (SELECT p."FISCAL_PERIOD_DESC" FROM period_mst p WHERE p."PERIOD_ID" = lr."LEAVE_PERIOD_ID" LIMIT 1) AS "LEAVE_PERIOD",
  lr."DATE_APPLIED",
  lr."LEAVE_EMP_ID" AS "LEAVEEMPID",
  (SELECT le."REF_EMP_ID" FROM leave_employee le WHERE le."LEAVE_EMP_ID" = lr."LEAVE_EMP_ID" LIMIT 1) AS "EMP_ID",
  (SELECT le."EMP_NM" FROM leave_employee le WHERE le."LEAVE_EMP_ID" = lr."LEAVE_EMP_ID" LIMIT 1) AS "EMP_NM",
  (SELECT e."EMP_NBR" FROM emp_mst e
    WHERE e."REF_EMP_ID" = (SELECT le."REF_EMP_ID" FROM leave_employee le WHERE le."LEAVE_EMP_ID" = lr."LEAVE_EMP_ID" LIMIT 1)
    LIMIT 1) AS "EMP_CODE",
  lr."LEAVE_COMMENTS" AS "LEAVE_REASON",
  lr."START_DATE"::date AS "START_DATE",
  lr."END_DATE"::date AS "END_DATE",
  CASE WHEN lr."HALF_DAY" THEN 'Yes' ELSE 'No' END AS "HALF_DAY",
  lr."LEAVES_APPLIED",
  lr."LEAVE_STATUS",
  (SELECT im."MSTR_CD" FROM independent_mst im WHERE im."MSTR_ID" = lr."LEAVE_STATUS" LIMIT 1) AS "LEAVE_STATUS_CD",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = lr."LEAVE_STATUS" LIMIT 1) AS "LEAVE_STATUS_NM",
  lr."COMMENT" AS "LEAVE_COMMENT",
  lr."LEAVE_PERIOD_ID",
  lr."LEAVE_TYPE_NAME",
  lr."LEAVE_EMP_ID",
  lr."LEAVE_COMMENTS",
  lr."COMMENT",
  lr."OA_ID" AS "OAID",
  (SELECT o."OA_CD" FROM org_accounts o WHERE o."OA_ID" = lr."OA_ID" LIMIT 1) AS "OA_CD",
  (SELECT o."OA_NM" FROM org_accounts o WHERE o."OA_ID" = lr."OA_ID" LIMIT 1) AS "OA_NM",
  lr."USER_ID" AS "USERID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = lr."USER_ID" LIMIT 1) AS "USER_NM",
  lr."APPROVER_ID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = lr."APPROVER_ID" LIMIT 1) AS "APPROVER_NM",
  lr."OA_BRAND_ID" AS "OABRANDID",
  (SELECT b."OA_BRAND_CD" FROM oa_brands b WHERE b."OA_BRAND_ID" = lr."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_CD",
  (SELECT b."OA_BRAND_NM" FROM oa_brands b WHERE b."OA_BRAND_ID" = lr."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_NM",
  lr."CREATED_BY" AS "CREATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = lr."CREATED_BY" LIMIT 1) AS "CREATED_BY_USER_NAME",
  lr."UPDATED_BY" AS "UPDATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = lr."UPDATED_BY" LIMIT 1) AS "UPDATED_BY_USER_NAME",
  lr."CREATED_ON" AS "Created_On",
  lr."UPDATED_ON" AS "Updated_On",
  lr."IS_DELETED"
FROM leave_requests_dtl lr
WHERE lr."IS_DELETED" = 0;

CREATE VIEW leave_request_pending_vw AS
SELECT
  v."LEAVE_REQUEST_ID",
  v."LEAVE_TYPE_ID",
  v."LEAVE_TYP_CD",
  v."LEAVE_TYP",
  v."LEAVEPERIODID",
  v."LEAVE_PERIOD",
  v."DATE_APPLIED",
  v."LEAVEEMPID",
  v."EMP_ID",
  v."EMP_NM",
  v."LEAVE_REASON",
  v."START_DATE",
  v."END_DATE",
  v."HALF_DAY",
  v."LEAVES_APPLIED",
  v."LEAVE_STATUS",
  v."LEAVE_STATUS_CD",
  v."LEAVE_STATUS_NM",
  v."LEAVE_COMMENT",
  v."OAID",
  v."OA_CD",
  v."OA_NM",
  v."USERID",
  v."USER_NM",
  v."APPROVER_ID",
  v."APPROVER_NM",
  v."OABRANDID",
  v."OA_BRAND_CD",
  v."OA_BRAND_NM",
  v."CREATED_BY_USER_ID",
  v."CREATED_BY_USER_NAME",
  v."UPDATED_BY_USER_ID",
  v."UPDATED_BY_USER_NAME",
  v."Created_On",
  v."Updated_On",
  v."IS_DELETED"
FROM leave_request_vw v
WHERE v."LEAVE_STATUS_CD" = 'LEPE';

COMMIT;
