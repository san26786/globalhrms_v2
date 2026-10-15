-- company_documents_vw — the list behind CI systmMngt/company_documents ("Company Documents").
--
-- The CI MySQL view was not migrated; rebuilt from its entity configuration (entity_obj_attrbt rows of
-- OBJ_NM = 'company_documents_vw') over member_attachment. CI listed it filtered on
-- LINKED_SYSTEM_ENTITY_TYPE_ID = common_type CDT (283). Names come from LIMIT 1 sub-queries because
-- independent_mst / user_group hold duplicated rows. IS_DELETED is cast to 0 / 1 (boolean in member_attachment).
-- Reconstructed: confirm against the original (SHOW CREATE VIEW company_documents_vw) if you have it.
--
-- Review, then run once:  psql "$DATABASE_URL" -f prisma/sql/views/company_documents_vw.sql

BEGIN;

DROP VIEW IF EXISTS company_documents_vw;

CREATE VIEW company_documents_vw AS
SELECT
  m."ID",
  m."FILENAME",
  m."LINKED_MASTER_DOC_TYPE_ID",
  m."LINKED_SYSTEM_ENTITY_TYPE_ID",
  m."DOC_CATEGORY_ID",
  m."DOC_SUB_CATEGORY_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = m."DOC_CATEGORY_ID" ORDER BY im."MSTR_ID" LIMIT 1) AS "DOC_CATEGORY",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = m."DOC_SUB_CATEGORY_ID" ORDER BY im."MSTR_ID" LIMIT 1) AS "DOC_SUB_CATEGORY",
  CASE WHEN m."IS_PUBLIC" = 1 THEN 'Yes' ELSE 'No' END AS "IS_PUBLIC",
  m."USER_GROUP_ID",
  m."USER_GROUP_ID" AS "USERGROUPID",
  (SELECT g."USER_GRP_NM" FROM user_group g WHERE g."USER_GRP_ID" = m."USER_GROUP_ID" LIMIT 1) AS "USER_GROUP",
  m."DOC_TYPE_ID",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = m."DOC_TYPE_ID" ORDER BY im."MSTR_ID" LIMIT 1) AS "DOC_TYPE",
  CASE WHEN m."IS_DELETED" THEN 1 ELSE 0 END AS "IS_DELETED",
  m."OA_ID",
  m."OA_BRAND_ID",
  m."OA_BRAND_ID" AS "OABRANDID",
  m."USER_ID",
  m."CREATED_BY",
  m."CREATED_ON",
  m."UPDATED_BY",
  m."UPDATED_ON"
FROM member_attachment m;

COMMIT;
