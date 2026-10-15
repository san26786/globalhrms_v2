-- document_templates_variables_vw — the list behind CI systmMngt/document_templates_variables.
--
-- The CI MySQL view was not migrated; its entity configuration (entity_obj_attrbt rows of
-- OBJ_NM = 'document_templates_variables_vw') lists exactly the table's columns.
--
-- Review, then run once:  psql "$DATABASE_URL" -f prisma/sql/views/document_templates_variables_vw.sql

BEGIN;

DROP VIEW IF EXISTS document_templates_variables_vw;

CREATE VIEW document_templates_variables_vw AS
SELECT
  v."ID",
  v."TEMPLATE_ID",
  v."TEMPLATE_CD",
  v."VIEW_NAME",
  v."VARIABLE",
  v."FIELD_NAME",
  v."IS_CUSTOM",
  v."IS_DELETED",
  v."OA_ID",
  v."USER_ID",
  v."OA_BRAND_ID",
  v."CREATED_BY",
  v."UPDATED_BY",
  v."CREATED_ON",
  v."UPDATED_ON"
FROM document_templates_variables v;

COMMIT;
