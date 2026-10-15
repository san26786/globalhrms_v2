-- employee_payment_details_vw / _monthly_vw / _yearly_vw — the lists behind CI
-- systmMngt/employee_payment_details ("Payroll Processing"), emp_monthly_payment_details ("Emp Monthly
-- Salary") and emp_yearly_payment_details ("Emp Yearly Salary").
--
-- The CI MySQL views were not migrated and their definitions are not in the CI source; rebuilt from the
-- entity configuration (entity_obj_attrbt rows of each OBJ_NM). The monthly / yearly views are per
-- employee and calendar month / year: amounts summed, DEDUCT_AMOUNT = the components whose pay group
-- head is a deduction (PGHGD / PGHTA / PGHNT — the heads CI's payslip deducted). Reconstructed: confirm
-- against the originals (SHOW CREATE VIEW …) if you have them.
-- Names come from LIMIT 1 sub-queries because independent_mst / org_accounts / oa_brands / user_mst hold
-- duplicated rows.
--
-- Review, then run once:  psql "$DATABASE_URL" -f prisma/sql/views/employee_payment_details_views.sql

BEGIN;

DROP VIEW IF EXISTS employee_payment_details_monthly_vw;
DROP VIEW IF EXISTS employee_payment_details_yearly_vw;
DROP VIEW IF EXISTS employee_payment_details_vw;

CREATE VIEW employee_payment_details_vw AS
SELECT
  p."EP_ID",
  p."EMP_ID",
  p."EMP_ID" AS "EMPID",
  (SELECT TRIM(CONCAT(COALESCE(e."EMP_NAME", ''), ' ', COALESCE(e."EMP_MIDDLE_NM", ''), ' ', COALESCE(e."EMPLST_NM", '')))
     FROM emp_mst e WHERE e."EMP_ID" = p."EMP_ID" LIMIT 1) AS "EMP_NAME",
  p."CALENDAR_ID",
  p."FINANCIAL_YEAR_ID",
  (SELECT pm."FISCAL_PERIOD_DESC" FROM period_mst pm WHERE pm."PERIOD_ID" = p."FINANCIAL_YEAR_ID" LIMIT 1) AS "FINANCIAL_YEAR",
  p."BENEFIT_ID",
  p."BENEFIT_ID"::bigint AS "BENEFIT_COMPONENT_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = p."BENEFIT_ID" ORDER BY im."MSTR_ID" LIMIT 1) AS "BENEFIT",
  p."PAY_FREQUENCY",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = p."PAY_FREQUENCY" ORDER BY im."MSTR_ID" LIMIT 1) AS "PAY_FREQUENCY_NM",
  p."CALENDAR_YEAR",
  p."CALENDAR_MONTH",
  p."CALENDAR_WEEK",
  p."START_DATE",
  p."END_DATE",
  p."ACTUAL_AMOUNT",
  p."EARNED_AMOUNT",
  p."ADDITIONAL_COMMENTS",
  CASE WHEN p."IS_DELETED" THEN 1 ELSE 0 END AS "IS_DELETED",
  p."OA_ID" AS "OAID",
  (SELECT o."OA_CD" FROM org_accounts o WHERE o."OA_ID" = p."OA_ID" LIMIT 1) AS "OA_CD",
  (SELECT o."OA_NM" FROM org_accounts o WHERE o."OA_ID" = p."OA_ID" LIMIT 1) AS "OA_NM",
  p."OA_BRAND_ID" AS "OABRANDID",
  (SELECT b."OA_BRAND_CD" FROM oa_brands b WHERE b."OA_BRAND_ID" = p."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_CD",
  (SELECT b."OA_BRAND_NM" FROM oa_brands b WHERE b."OA_BRAND_ID" = p."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_NM",
  p."CREATED_BY" AS "CREATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = p."CREATED_BY" LIMIT 1) AS "CREATED_BY_USER_NAME",
  p."UPDATED_BY" AS "UPDATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = p."UPDATED_BY" LIMIT 1) AS "UPDATED_BY_USER_NAME",
  p."USER_ID" AS "USERID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = p."USER_ID" LIMIT 1) AS "USER_NAME",
  p."CREATED_ON",
  p."UPDATED_ON"
FROM employee_payment_details p;

-- Per employee and month (CALENDAR_MONTH_ID = year * 100 + month).
CREATE VIEW employee_payment_details_monthly_vw AS
SELECT
  v."EMP_ID",
  MAX(v."EMP_NAME") AS "EMP_NM",
  v."CALENDAR_YEAR" * 100 + v."CALENDAR_MONTH" AS "CALENDAR_MONTH_ID",
  SUM(v."ACTUAL_AMOUNT")::double precision AS "ACTUAL_AMOUNT",
  SUM(v."EARNED_AMOUNT")::double precision AS "EARNED_AMOUNT",
  SUM(CASE WHEN (SELECT im."MSTR_CD" FROM independent_mst im WHERE im."MSTR_ID" = p."PAY_GROUP_HEAD_ID" LIMIT 1) IN ('PGHGD', 'PGHTA', 'PGHNT')
           THEN v."EARNED_AMOUNT" ELSE 0 END)::double precision AS "DEDUCT_AMOUNT",
  MAX(v."FINANCIAL_YEAR_ID") AS "FINANCIAL_YEAR_ID",
  MAX(v."PAY_FREQUENCY") AS "PAY_FREQUENCY_ID",
  MAX(v."PAY_FREQUENCY_NM") AS "PAY_FREQUENCY",
  v."OAID" AS "OA_ID",
  MAX(v."OA_CD") AS "OA_CD",
  MAX(v."OA_NM") AS "OA_NM",
  v."OABRANDID" AS "OA_BRAND_ID",
  MAX(v."OA_BRAND_CD") AS "OA_BRAND_CD",
  MAX(v."OA_BRAND_NM") AS "OA_BRAND_NM",
  MAX(v."USERID") AS "USER_ID",
  MAX(v."USER_NAME") AS "USER_NM"
FROM employee_payment_details_vw v
JOIN employee_payment_details p ON p."EP_ID" = v."EP_ID"
WHERE v."IS_DELETED" = 0
GROUP BY v."EMP_ID", v."CALENDAR_YEAR", v."CALENDAR_MONTH", v."OAID", v."OABRANDID";

-- Per employee and year.
CREATE VIEW employee_payment_details_yearly_vw AS
SELECT
  v."EMP_ID",
  MAX(v."EMP_NAME") AS "EMP_NM",
  v."CALENDAR_YEAR" AS "CALENDAR_YEAR_ID",
  SUM(v."ACTUAL_AMOUNT")::double precision AS "ACTUAL_AMOUNT",
  SUM(v."EARNED_AMOUNT")::double precision AS "EARNED_AMOUNT",
  SUM(CASE WHEN (SELECT im."MSTR_CD" FROM independent_mst im WHERE im."MSTR_ID" = p."PAY_GROUP_HEAD_ID" LIMIT 1) IN ('PGHGD', 'PGHTA', 'PGHNT')
           THEN v."EARNED_AMOUNT" ELSE 0 END)::double precision AS "DEDUCT_AMOUNT",
  MAX(v."FINANCIAL_YEAR_ID") AS "FINANCIAL_YEAR_ID",
  MAX(v."PAY_FREQUENCY") AS "PAY_FREQUENCY_ID",
  MAX(v."PAY_FREQUENCY_NM") AS "PAY_FREQUENCY",
  v."OAID" AS "OA_ID",
  MAX(v."OA_CD") AS "OA_CD",
  MAX(v."OA_NM") AS "OA_NM",
  v."OABRANDID" AS "OA_BRAND_ID",
  MAX(v."OA_BRAND_CD") AS "OA_BRAND_CD",
  MAX(v."OA_BRAND_NM") AS "OA_BRAND_NM",
  MAX(v."USERID") AS "USER_ID",
  MAX(v."USER_NAME") AS "USER_NM"
FROM employee_payment_details_vw v
JOIN employee_payment_details p ON p."EP_ID" = v."EP_ID"
WHERE v."IS_DELETED" = 0
GROUP BY v."EMP_ID", v."CALENDAR_YEAR", v."OAID", v."OABRANDID";

COMMIT;
