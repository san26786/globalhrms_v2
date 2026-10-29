-- emp_manager_new_vw — employees (not deleted) with their looked-up names: title, gender, marital
-- status, department, status, manager, contact e-mail / phone, organisation and brand.
-- Used by the Employee dashboard (current / former employee counts by EMP_STATUS_ID, OABRANDID).
--
-- Ported from the original CI MySQL view (SHOW CREATE VIEW in the live dump, globalin_latest,
-- 2026-10-09). Same columns, names and order. Differences, all forced by PostgreSQL:
--   * MySQL let a sub-query use another column's alias (OAID, OABRANDID, DEPARTMENTID, PHONE_NBR);
--     here the underlying column / expression is used instead.
--   * BLOOD_GRP, COUNTRY_CODE and the OA_CNTCT_EML_ID / OA_CNTCT_PHONE_ID links are text columns
--     holding ids. A whole-number value is compared as that id; anything else (a few rows hold an
--     e-mail address) matches nothing — MySQL would have read "1997someone@…" as id 1997.
--   * IS_MANAGER / EMP_MILITARY_SERVICE are text: "1" means Yes, as MySQL's `= 1` did.
--   * Look-ups take LIMIT 1, so a duplicated master row cannot make the whole view fail.
--
-- Review, then run once:  psql "$DATABASE_URL" -f prisma/sql/views/emp_manager_new_vw.sql

BEGIN;

DROP VIEW IF EXISTS emp_manager_new_vw;

CREATE VIEW emp_manager_new_vw AS
SELECT
  em."EMP_ID",
  em."TITLE",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = em."TITLE" LIMIT 1) AS "TITLE_NM",
  em."EMP_NBR",
  em."EMP_NAME",
  em."EMP_MIDDLE_NM",
  em."EMPLST_NM",
  em."KNOWN_AS",
  COALESCE(em."EMP_NAME", '') || ' ' || COALESCE(em."EMP_MIDDLE_NM", '') || ' ' || COALESCE(em."EMPLST_NM", '') AS "EMP_FULL_NAME",
  em."EMP_INITIALS",
  CASE WHEN em."IS_MANAGER" ~ '^\s*0*1(\.0*)?\s*$' THEN 'Yes' ELSE 'No' END AS "IS_MANAGER",
  em."MANAGER_ID",
  (SELECT COALESCE(m."EMP_NAME", '') || ' ' || COALESCE(m."EMP_MIDDLE_NM", '') || ' ' || COALESCE(m."EMPLST_NM", '')
     FROM emp_mst m WHERE m."EMP_ID" = em."MANAGER_ID" LIMIT 1) AS "MANAGER",
  em."HR_EXECUTIVE_ID",
  em."DOB",
  em."GENDER_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = em."GENDER_ID" LIMIT 1) AS "GENDER",
  em."MARITAL_STATUS_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = em."MARITAL_STATUS_ID" LIMIT 1) AS "MARITAL_STATUS",
  em."MARRIAGE_DATE",
  em."MAIDEN_NAME",
  em."EXT_REF_EMP_NO",
  em."TAX_REF_NO",
  CASE WHEN em."IS_DISABLE" = 1 THEN 'Yes' ELSE 'No' END AS "IS_DISABLE",
  em."NI_TABLE",
  em."CAST_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = em."CAST_ID" LIMIT 1) AS "CAST",
  em."RAISE_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = em."RAISE_ID" LIMIT 1) AS "RAISE",
  em."ETHINICITY_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = em."ETHINICITY_ID" LIMIT 1) AS "ETHINICITY",
  em."BLOOD_GRP" AS "BLOOD_GRP_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im
    WHERE im."MSTR_ID" = CASE WHEN em."BLOOD_GRP" ~ '^\s*-?[0-9]+\s*$' THEN btrim(em."BLOOD_GRP")::bigint END LIMIT 1) AS "BLOOD_GRP_NM",
  CASE WHEN em."IS_SMOKER" = 1 THEN 'Yes' ELSE 'No' END AS "IS_SMOKER",
  em."OA_CNTCT_EML_ID",
  (SELECT ea."EMAIL_ADD" FROM email_address_mst ea
    WHERE ea."EMAIL_ADD_ID" = (
      SELECT ce."EMAIL_ADD_ID" FROM contact_emails ce
       WHERE ce."CNTCT_EML_ID" = (
         SELECT CASE WHEN oce."CNTCT_EML_ID" ~ '^\s*-?[0-9]+\s*$' THEN btrim(oce."CNTCT_EML_ID")::bigint END
           FROM oa_contact_emails oce
          WHERE oce."OA_CNTCT_EML_ID" = CASE WHEN em."OA_CNTCT_EML_ID" ~ '^\s*-?[0-9]+\s*$' THEN btrim(em."OA_CNTCT_EML_ID")::bigint END
          LIMIT 1)
       LIMIT 1)
    LIMIT 1) AS "EMAIL_ADD",
  em."OA_CNTCT_PHONE_ID",
  (SELECT pn."PHONE_NBR" FROM phone_nbr_mst pn
    WHERE pn."PHONE_NBR_ID" = (
      SELECT cp."PHONE_NBR_ID" FROM contact_phones cp
       WHERE cp."CNTCT_PHONE_ID" = (
         SELECT CASE WHEN ocp."CNTCT_PHONE_ID" ~ '^\s*-?[0-9]+\s*$' THEN btrim(ocp."CNTCT_PHONE_ID")::bigint END
           FROM oa_contact_phones ocp
          WHERE ocp."OA_CNTCT_PHONE_ID" = CASE WHEN em."OA_CNTCT_PHONE_ID" ~ '^\s*-?[0-9]+\s*$' THEN btrim(em."OA_CNTCT_PHONE_ID")::bigint END
          LIMIT 1)
       LIMIT 1)
    LIMIT 1) AS "PHONE_NBR",
  -- Country name + ' ' + phone number; empty when either is missing (MySQL CONCAT).
  (SELECT im."MSTR_NM" FROM independent_mst im
    WHERE im."MSTR_ID" = CASE WHEN em."COUNTRY_CODE" ~ '^\s*-?[0-9]+\s*$' THEN btrim(em."COUNTRY_CODE")::bigint END LIMIT 1)
  || ' ' ||
  (SELECT pn."PHONE_NBR" FROM phone_nbr_mst pn
    WHERE pn."PHONE_NBR_ID" = (
      SELECT cp."PHONE_NBR_ID" FROM contact_phones cp
       WHERE cp."CNTCT_PHONE_ID" = (
         SELECT CASE WHEN ocp."CNTCT_PHONE_ID" ~ '^\s*-?[0-9]+\s*$' THEN btrim(ocp."CNTCT_PHONE_ID")::bigint END
           FROM oa_contact_phones ocp
          WHERE ocp."OA_CNTCT_PHONE_ID" = CASE WHEN em."OA_CNTCT_PHONE_ID" ~ '^\s*-?[0-9]+\s*$' THEN btrim(em."OA_CNTCT_PHONE_ID")::bigint END
          LIMIT 1)
       LIMIT 1)
    LIMIT 1) AS "FULL_PHONE_NBR",
  em."EMP_SSN_NBR",
  em."EMP_SIN_NBR",
  em."EMP_PAN_NBR",
  em."EMP_DRI_LICE_NBR",
  em."EMP_DRI_LICE_EXP_DATE",
  em."TAX_ALLOWANCE_TYPE_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = em."TAX_ALLOWANCE_TYPE_ID" LIMIT 1) AS "TAX_ALLOWANCE_TYPE_NM",
  CASE WHEN em."EMP_MILITARY_SERVICE" ~ '^\s*0*1(\.0*)?\s*$' THEN 'Yes' ELSE 'No' END AS "EMP_MILITARY_SERVICE",
  CASE WHEN em."IS_DIRECTOR" = 1 THEN 'Yes' ELSE 'No' END AS "IS_DIRECTOR",
  CASE WHEN em."IS_BUSINESS_OWNER" = 1 THEN 'Yes' ELSE 'No' END AS "IS_BUSINESS_OWNER",
  CASE WHEN em."IS_PSC" = 1 THEN 'Yes' ELSE 'No' END AS "IS_PSC",
  CASE WHEN em."IS_SHAREHOLDER" = 1 THEN 'Yes' ELSE 'No' END AS "IS_SHAREHOLDER",
  em."EMP_STATUS_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = em."EMP_STATUS_ID" LIMIT 1) AS "EMP_STATUS",
  em."SKYPE_ID",
  -- The employee's latest job row decides department and job status.
  (SELECT j."DEPARTMENT_ID" FROM job_mst j WHERE j."EMP_ID" = em."EMP_ID" ORDER BY j."JOB_ID" DESC LIMIT 1) AS "DEPARTMENTID",
  (SELECT j."EMP_STATUS_ID" FROM job_mst j WHERE j."EMP_ID" = em."EMP_ID" ORDER BY j."JOB_ID" DESC LIMIT 1) AS "EMP_JOB_STATUS",
  (SELECT im."MSTR_NM" FROM independent_mst im
    WHERE im."MSTR_ID" = (SELECT j."DEPARTMENT_ID" FROM job_mst j WHERE j."EMP_ID" = em."EMP_ID" ORDER BY j."JOB_ID" DESC LIMIT 1)
    LIMIT 1) AS "DEPARTMENT",
  em."CAREERSTREAM_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = em."CAREERSTREAM_ID" LIMIT 1) AS "CAREERSTREAM_NM",
  em."OA_ID" AS "OAID",
  (SELECT o."OA_CD" FROM org_accounts o WHERE o."OA_ID" = em."OA_ID" LIMIT 1) AS "OA_CD",
  (SELECT o."OA_NM" FROM org_accounts o WHERE o."OA_ID" = em."OA_ID" LIMIT 1) AS "OA_NM",
  em."OA_BRAND_ID" AS "OABRANDID",
  (SELECT b."OA_BRAND_CD" FROM oa_brands b WHERE b."OA_BRAND_ID" = em."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_CD",
  (SELECT b."OA_BRAND_NM" FROM oa_brands b WHERE b."OA_BRAND_ID" = em."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_NM",
  em."REF_EMP_ID" AS "USERID",
  (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = em."REF_EMP_ID" LIMIT 1) AS "USER_NM",
  em."IS_DELETED"
FROM emp_mst em
WHERE em."IS_DELETED" = 0;

COMMIT;
