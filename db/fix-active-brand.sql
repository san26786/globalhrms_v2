-- Clears the "No active brand on session" error from /api/menu.
--
-- Two problems this addresses:
--   1. Your registered user has OA_BRAND_ID = NULL, and app/api/menu/route.ts
--      returns 400 before running any query when that is missing.
--   2. Your user is not a sysadmin, so the menu query takes the permission-
--      filtered branch and needs a permission class that does not exist yet.
--      Setting IS_SYSADMIN routes it through relationship_dtl_vw instead.
--
-- IMPORTANT: this does NOT make menu items appear. The menu tables are empty,
-- so the API will go from returning an error to returning {"menu":[]}. That is
-- the expected result until the legacy menu data is imported.
--
-- Run against globalhr, then LOG OUT AND LOG IN AGAIN — oaBrandId and
-- isSysAdmin are baked into the JWT when the token is minted at login.

-- Step 1: create a brand for your existing organisation.
INSERT INTO oa_brands (
  "OA_BRAND_CD", "OA_BRAND_NM", "OA_ID",
  "SUBSCRIPTION_RATE", "SUBSCRIPTION_LEVEL_ID", "UPDATED_ON"
)
SELECT
  'MAIN',
  LEFT(oa."OA_NM", 40),
  oa."OA_ID",
  0,
  1,
  now()
FROM org_accounts oa
WHERE oa."IS_DELETED" = 0
ORDER BY oa."OA_ID"
LIMIT 1;

-- Step 2: point every non-deleted user at that brand and make them sysadmin.
-- Narrow the WHERE clause if you ever have more than your own test account.
UPDATE user_mst
SET "OA_BRAND_ID" = (SELECT MAX(b."OA_BRAND_ID") FROM oa_brands b),
    "IS_SYSADMIN" = true
WHERE "IS_DELETED" IS NOT TRUE;

-- Step 3: confirm.
SELECT
  u."USER_ID", u."USER_NAME", u."OA_ID", u."OA_BRAND_ID",
  u."IS_ADMIN", u."IS_SYSADMIN",
  b."OA_BRAND_NM"
FROM user_mst u
LEFT JOIN oa_brands b ON b."OA_BRAND_ID" = u."OA_BRAND_ID";
