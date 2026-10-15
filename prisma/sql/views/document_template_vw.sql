-- document_template_vw — the list behind CI systmMngt/document_template ("Document Template"), also read
-- by CI's offer / appointment letter generation (getTemplateBodyByCd / ById).
--
-- The CI MySQL view was not migrated; rebuilt from its entity configuration (entity_obj_attrbt rows of
-- OBJ_NM = 'document_template_vw'): the template master's code / name next to the body. LIMIT 1
-- sub-queries because independent_mst holds duplicated rows.
-- Reconstructed: confirm against the original (SHOW CREATE VIEW document_template_vw) if you have it.
--
-- Review, then run once:  psql "$DATABASE_URL" -f prisma/sql/views/document_template_vw.sql

BEGIN;

DROP VIEW IF EXISTS document_template_vw;

CREATE VIEW document_template_vw AS
SELECT
  d."ID",
  d."TEMPLATE_ID",
  (SELECT im."MSTR_CD" FROM independent_mst im WHERE im."MSTR_ID" = d."TEMPLATE_ID" ORDER BY im."MSTR_ID" LIMIT 1) AS "TEMPLATE_CD",
  (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = d."TEMPLATE_ID" ORDER BY im."MSTR_ID" LIMIT 1) AS "TEMPLATE_NM",
  d."TEMPLATE_BODY",
  d."IS_DELETED",
  d."OA_ID",
  d."USER_ID",
  d."OA_BRAND_ID",
  d."CREATED_BY",
  d."UPDATED_BY",
  d."CREATED_ON",
  d."UPDATED_ON"
FROM document_template d;

COMMIT;
