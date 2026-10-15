-- Repair authority_level rows written by CI authoritylevel_m::insert/update.
--
-- CI passed (userId, oaId, brandId) to a method declared (oaId, brandId, userId), so legacy rows hold
--   OA_ID = user id, OA_BRAND_ID = org account id, USER_ID = brand id.
-- The Next list is scoped by OA_BRAND_ID = active brand, so those rows never showed up.
--
-- Rotates the three columns back. Only rows whose (OA_BRAND_ID, USER_ID) is a real (org, brand) pair
-- and whose OA_BRAND_ID is not itself a brand of that org are touched, so the script is idempotent
-- and leaves rows created by the Next app alone. Postgres evaluates every SET expression against
-- the old row, so the rotation is safe in one statement.

BEGIN;

UPDATE authority_level a
SET "OA_ID"       = a."OA_BRAND_ID",
    "OA_BRAND_ID" = a."USER_ID",
    "USER_ID"     = NULLIF(a."OA_ID", 0)
WHERE EXISTS (
        SELECT 1 FROM oa_brands b
        WHERE b."OA_ID" = a."OA_BRAND_ID" AND b."OA_BRAND_ID" = a."USER_ID"
      )
  AND NOT EXISTS (
        SELECT 1 FROM oa_brands b
        WHERE b."OA_BRAND_ID" = a."OA_BRAND_ID" AND b."OA_ID" = a."OA_ID"
      );

COMMIT;
