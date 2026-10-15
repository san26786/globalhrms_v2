-- Legacy MySQL views converted to PostgreSQL.
--
-- Two mechanical differences from the MySQL originals:
--   1. Backtick identifiers become double-quoted (columns are uppercase, so
--      the quotes are required — unquoted identifiers fold to lowercase).
--   2. MySQL allows a subquery to reference an output alias defined earlier
--      in the same SELECT list; PostgreSQL does not. Each such reference has
--      been replaced with the underlying column, which is equivalent.
--
-- DEFINER / SQL SECURITY DEFINER clauses are dropped: PostgreSQL has no
-- DEFINER, and its equivalent (security_invoker = false) is already the
-- default for views.
--
-- Run against the globalhr database. Safe to re-run.

-- ---------------------------------------------------------------------------
-- relationship_dtl_vw  — used by the sidebar menu (sysadmin branch)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW relationship_dtl_vw AS
SELECT
  rd."REL_DET_ID"                 AS "REL_DET_ID",
  rd."HIER_LEVEL_CONFIG_ID"       AS "HIER_LEVEL_CONFIG_ID",
  rd."LEVEL_SEQ"                  AS "LEVEL_SEQ",
  rd."CHILD_ID"                   AS "CHILD_MSTR_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im
    WHERE im."MSTR_ID" = rd."CHILD_ID")                     AS "CHILD_MSTR_NM",
  rd."PARENT_ID"                  AS "PARENT_HIER_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im
    WHERE im."MSTR_ID" = rd."PARENT_ID")                    AS "PARENT_MSTR_NM",
  rd."CHILD_ID"                   AS "CHILD_ID",
  rd."PARENT_ID"                  AS "PARENT_ID",
  rd."HIER_TYPE_ID"               AS "HIER_TYPE_ID",
  (SELECT ct."TYP_NM" FROM common_type ct
    WHERE ct."TYP_ID" = rd."HIER_TYPE_ID")                  AS "HIER_TYPE_NM",
  rd."HIER_CHILD_ENTITY_TYPE_ID"  AS "HIER_CHILD_ENTITY_TYPE_ID",
  (SELECT ct."TYP_NM" FROM common_type ct
    WHERE ct."TYP_ID" = rd."HIER_CHILD_ENTITY_TYPE_ID")     AS "HIER_CHILD_ENTITY_TYPE_NM",
  rd."HIER_PARENT_ENTITY_TYPE_ID" AS "HIER_PARENT_ENTITY_TYPE_ID",
  (SELECT ct."TYP_NM" FROM common_type ct
    WHERE ct."TYP_ID" = rd."HIER_PARENT_ENTITY_TYPE_ID")    AS "HIER_PARENT_ENTITY_TYPE_NM",
  rd."ENABLED"                    AS "ENABLED",
  rd."OA_ID"                      AS "ORG_ACC_ID",
  (SELECT oa."OA_CD" FROM org_accounts oa
    WHERE oa."OA_ID" = rd."OA_ID")                          AS "OA_CD",
  (SELECT oa."OA_NM" FROM org_accounts oa
    WHERE oa."OA_ID" = rd."OA_ID")                          AS "OA_NM",
  rd."OA_BRAND_ID"                AS "BRAND_ID",
  (SELECT b."OA_BRAND_CD" FROM oa_brands b
    WHERE b."OA_BRAND_ID" = rd."OA_BRAND_ID")               AS "OA_BRAND_CD",
  (SELECT b."OA_BRAND_NM" FROM oa_brands b
    WHERE b."OA_BRAND_ID" = rd."OA_BRAND_ID")               AS "OA_BRAND_NM",
  rd."USER_ID"                    AS "USERID",
  (SELECT u."USER_NAME" FROM user_mst u
    WHERE u."USER_ID" = rd."USER_ID")                       AS "USER_NM",
  rd."CREATED_BY"                 AS "CREATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u
    WHERE u."USER_ID" = rd."CREATED_BY")                    AS "CREATED_BY_USER_NAME",
  rd."UPDATED_BY"                 AS "UPDATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u
    WHERE u."USER_ID" = rd."UPDATED_BY")                    AS "UPDATED_BY_USER_NAME",
  rd."CREATED_ON"                 AS "CREATED_ON",
  rd."UPDATED_ON"                 AS "UPDATED_ON",
  rd."IS_DELETED"                 AS "IS_DELETED"
FROM relationship_dtl rd;

-- ---------------------------------------------------------------------------
-- relationship_type_mst_vw
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW relationship_type_mst_vw AS
SELECT
  im."MSTR_ID"        AS "MSTR_ID",
  im."MSTR_CD"        AS "MSTR_CD",
  im."MSTR_NM"        AS "MSTR_NM",
  im."TYP_ID"         AS "TYP_ID",
  im."RECORD_TYP"     AS "RECORD_TYP",
  im."PARENT_MSTR_ID" AS "PARENT_MSTR_ID",
  im."IS_EDITABLE"    AS "IS_EDITABLE",
  im."IS_PREDEFINED"  AS "IS_PREDEFINED",
  im."IS_DELETED"     AS "IS_DELETED",
  im."OA_ID"          AS "OA_ID",
  im."OA_BRAND_ID"    AS "OA_BRAND_ID",
  im."USER_ID"        AS "USER_ID",
  im."CREATED_BY"     AS "CREATED_BY",
  im."UPDATED_BY"     AS "UPDATED_BY",
  im."CREATED_ON"     AS "CREATED_ON",
  im."UPDATED_ON"     AS "UPDATED_ON"
FROM independent_mst im
WHERE im."TYP_ID" = 160;

-- ---------------------------------------------------------------------------
-- application_mst_vw  — recruitment applications (not menu related)
-- NOTE: APPICATION_ID is misspelled in the legacy table; kept as-is.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW application_mst_vw AS
SELECT
  am."APPICATION_ID"          AS "APPICATION_ID",
  am."CANDIDATE_ID"           AS "CANDIDATE_ID",
  am."CANDIDATE_ID"           AS "CNDDT_ID",
  (SELECT cm."CANDIDATE_NAME" FROM candidate_mst cm
    WHERE cm."CANDIDATE_ID" = am."CANDIDATE_ID")        AS "CANDIDATE_NAME",
  am."VACANCY_ID"             AS "VACANCY_ID",
  am."VACANCY_ID"             AS "VACANCYID",
  (SELECT vm."VACANCY_NAME" FROM vacancy_mst vm
    WHERE vm."VACANCY_ID" = am."VACANCY_ID")            AS "VACANCY_NAME",
  am."APPLICATION_STATUS_ID"  AS "APPLICATION_STATUS_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im
    WHERE im."MSTR_ID" = am."APPLICATION_STATUS_ID")    AS "APPLICATION_STATUS",
  CAST(am."APPLIED_DATE" AS date)                       AS "APPLIED_DATE",
  am."OA_ID"                  AS "OAID",
  (SELECT oa."OA_CD" FROM org_accounts oa
    WHERE oa."OA_ID" = am."OA_ID")                      AS "OA_CD",
  (SELECT oa."OA_NM" FROM org_accounts oa
    WHERE oa."OA_ID" = am."OA_ID")                      AS "OA_NM",
  am."USER_ID"                AS "USERID",
  (SELECT u."USER_NAME" FROM user_mst u
    WHERE u."USER_ID" = am."USER_ID")                   AS "USER_NM",
  am."OA_BRAND_ID"            AS "BRAND_ID",
  (SELECT b."OA_BRAND_CD" FROM oa_brands b
    WHERE b."OA_BRAND_ID" = am."OA_BRAND_ID")           AS "OA_BRAND_CD",
  (SELECT b."OA_BRAND_NM" FROM oa_brands b
    WHERE b."OA_BRAND_ID" = am."OA_BRAND_ID")           AS "OA_BRAND_NM",
  am."CREATED_BY"             AS "CREATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u
    WHERE u."USER_ID" = am."CREATED_BY")                AS "CREATED_BY_USER_NAME",
  am."UPDATED_BY"             AS "UPDATED_BY_USER_ID",
  (SELECT u."USER_NAME" FROM user_mst u
    WHERE u."USER_ID" = am."UPDATED_BY")                AS "UPDATED_BY_USER_NAME",
  am."CREATED_ON"             AS "CREATED_ON",
  am."UPDATED_ON"             AS "UPDATED_ON",
  am."IS_DELETED"             AS "IS_DELETED"
FROM application_mst am;
