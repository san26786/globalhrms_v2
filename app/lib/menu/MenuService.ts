/**
 * Phase 15 — Dynamic Sidebar/Menu
 *
 * Ports left_menu_v.php's get_menu_from_relationship() to Postgres.
 *
 * Why raw SQL instead of the Prisma query builder: the original query has
 * conditional WHERE fragments (SHOW_TAB), a GROUP BY that MySQL resolves
 * leniently (picks an arbitrary row per group) but Postgres does not, and a
 * self-referential recursive call keyed on CHILD_MSTR_ID. Reproducing all of
 * that through the query builder would be more fragile than just keeping
 * the SQL shape close to the original and letting Postgres's DISTINCT ON
 * stand in for MySQL's GROUP BY dedupe-by-name behaviour.
 *
 * Two branches, exactly mirroring the PHP:
 *  - isSysAdmin (old is_admin == 2): reads relationship_dtl_vw, no
 *    permission filtering, no OA_BRAND_ID scoping (matches the PHP, which
 *    also does not scope this branch by brand).
 *  - everyone else: reads relationship_dtl + permission_dtl, filtered by
 *    permissions_class_id / oa_brand_id / licensing / app scoping.
 */

import { prisma } from '@/lib/prisma';
import type { MenuNode, MenuQueryParams, RawMenuRow } from '@/lib/menu/types';

// Fixed, hardcoded constants — inlined directly into the SQL text below as
// a literal IN-list. Safe to inline (not user input), and sidesteps any
// version/generator mismatch around Prisma.join/Prisma.sql/Prisma.empty
// (those tagged-template helpers aren't guaranteed to be exported the same
// way across Prisma client generators — plain prisma.$queryRaw`` tagged
// templates, used below, don't depend on them at all).
const EXCLUDED_MSTR_CD_LIST: string[] = ['CMFE', 'IMFE', 'FMSTM', 'OMFE'];

// Safety net against a bad PARENT_ID/CHILD_ID cycle in the data recursing
// forever — the PHP had no such guard (it relied on the hierarchy actually
// being a tree), but this costs nothing when the data is well-formed.
const MAX_DEPTH = 8;

export async function queryMenuLevel(params: MenuQueryParams): Promise<RawMenuRow[]> {
  const {
    isSysAdmin,
    oaBrandId,
    permissionsClassId,
    brandApplicationId,
    showTabs,
    parentId,
  } = params;

  if (isSysAdmin) {
    return showTabs
      ? prisma.$queryRaw<RawMenuRow[]>`
          WITH matched AS (
            SELECT
              im."MSTR_NM"        AS "MENU_NAME",
              rd."REL_DET_ID"     AS "REL_DET_ID",
              rd."CHILD_MSTR_ID"  AS "CHILD_MSTR_ID",
              mc."URL"            AS "URL",
              mc."SMALL_VIEW_ICON" AS "SMALL_VIEW_ICON",
              mc."sequence"       AS "SEQUENCE"
            FROM relationship_dtl_vw rd
            LEFT JOIN config_mapping_dtl cm ON cm."SRC_ENTTY_ID" = rd."CHILD_MSTR_ID"
            LEFT JOIN independent_mst im ON im."MSTR_ID" = cm."TRGT_ENTTY_ID"
            JOIN menu_config mc ON mc."MENU_ID" = rd."REL_DET_ID"
            WHERE rd."PARENT_HIER_ID" = ${parentId}
              AND mc."SHOW_TAB" = 1
              AND mc."SHOW_MENU" = 1
          )
          SELECT "MENU_NAME", "REL_DET_ID", "CHILD_MSTR_ID", "URL", "SMALL_VIEW_ICON"
          FROM (
            SELECT DISTINCT ON ("MENU_NAME") *
            FROM matched
            ORDER BY "MENU_NAME", "SEQUENCE" ASC NULLS LAST, "REL_DET_ID" ASC
          ) deduped
          ORDER BY "SEQUENCE" ASC NULLS LAST, "MENU_NAME" ASC
        `
      : prisma.$queryRaw<RawMenuRow[]>`
          WITH matched AS (
            SELECT
              im."MSTR_NM"        AS "MENU_NAME",
              rd."REL_DET_ID"     AS "REL_DET_ID",
              rd."CHILD_MSTR_ID"  AS "CHILD_MSTR_ID",
              mc."URL"            AS "URL",
              mc."SMALL_VIEW_ICON" AS "SMALL_VIEW_ICON",
              mc."sequence"       AS "SEQUENCE"
            FROM relationship_dtl_vw rd
            LEFT JOIN config_mapping_dtl cm ON cm."SRC_ENTTY_ID" = rd."CHILD_MSTR_ID"
            LEFT JOIN independent_mst im ON im."MSTR_ID" = cm."TRGT_ENTTY_ID"
            JOIN menu_config mc ON mc."MENU_ID" = rd."REL_DET_ID"
            WHERE rd."PARENT_HIER_ID" = ${parentId}
              AND mc."SHOW_MENU" = 1
          )
          SELECT "MENU_NAME", "REL_DET_ID", "CHILD_MSTR_ID", "URL", "SMALL_VIEW_ICON"
          FROM (
            SELECT DISTINCT ON ("MENU_NAME") *
            FROM matched
            ORDER BY "MENU_NAME", "SEQUENCE" ASC NULLS LAST, "REL_DET_ID" ASC
          ) deduped
          ORDER BY "SEQUENCE" ASC NULLS LAST, "MENU_NAME" ASC
        `;
  }

  // permissionsClassId must be resolved before calling this branch — the
  // route handler mirrors the PHP's `if (empty($permissions_class_id)) return [];`
  // check before ever reaching here.
  return showTabs
    ? prisma.$queryRaw<RawMenuRow[]>`
        WITH matched AS (
          SELECT
            im."MSTR_NM"        AS "MENU_NAME",
            rd."REL_DET_ID"     AS "REL_DET_ID",
            rd."CHILD_ID"       AS "CHILD_MSTR_ID",
            mc."URL"            AS "URL",
            mc."SMALL_VIEW_ICON" AS "SMALL_VIEW_ICON",
            mc."sequence"       AS "SEQUENCE"
          FROM relationship_dtl rd
          JOIN permission_dtl pd ON pd."PERMISSIONS_REF_ID" = rd."REL_DET_ID"
          LEFT JOIN config_mapping_dtl cm ON cm."SRC_ENTTY_ID" = rd."CHILD_ID"
          LEFT JOIN independent_mst im ON im."MSTR_ID" = cm."TRGT_ENTTY_ID"
          JOIN menu_config mc ON mc."MENU_ID" = rd."REL_DET_ID"
          JOIN "OA_Module_Config" moc ON moc."MSTR_ID" = rd."CHILD_ID"
          WHERE pd."PERMISSIONS_REF_TYPE_ID" = 1614
            AND pd."PERMISSION_ENABLED" = 1
            AND pd."PERMISSIONS_CLASS_ID" = ${permissionsClassId}
            AND pd."OA_BRAND_ID" = ${oaBrandId}
            AND moc."OA_BRAND_ID" = ${oaBrandId}
            AND moc."IS_ENABLED" = true
            AND moc."IS_LICENSED" = true
            AND rd."PARENT_ID" = ${parentId}
            AND im."MSTR_CD" != ALL(${EXCLUDED_MSTR_CD_LIST}::text[])
            AND (
              im."APP_ID" = ${brandApplicationId}
              OR im."APP_ID" IS NULL
              OR im."APP_ID" = 0
            )
            AND mc."SHOW_TAB" = 1
            AND mc."SHOW_MENU" = 1
        )
        SELECT "MENU_NAME", "REL_DET_ID", "CHILD_MSTR_ID", "URL", "SMALL_VIEW_ICON"
        FROM (
          SELECT DISTINCT ON ("MENU_NAME") *
          FROM matched
          ORDER BY "MENU_NAME", "SEQUENCE" ASC NULLS LAST, "REL_DET_ID" ASC
        ) deduped
        ORDER BY "SEQUENCE" ASC NULLS LAST, "MENU_NAME" ASC
      `
    : prisma.$queryRaw<RawMenuRow[]>`
        WITH matched AS (
          SELECT
            im."MSTR_NM"        AS "MENU_NAME",
            rd."REL_DET_ID"     AS "REL_DET_ID",
            rd."CHILD_ID"       AS "CHILD_MSTR_ID",
            mc."URL"            AS "URL",
            mc."SMALL_VIEW_ICON" AS "SMALL_VIEW_ICON",
            mc."sequence"       AS "SEQUENCE"
          FROM relationship_dtl rd
          JOIN permission_dtl pd ON pd."PERMISSIONS_REF_ID" = rd."REL_DET_ID"
          LEFT JOIN config_mapping_dtl cm ON cm."SRC_ENTTY_ID" = rd."CHILD_ID"
          LEFT JOIN independent_mst im ON im."MSTR_ID" = cm."TRGT_ENTTY_ID"
          JOIN menu_config mc ON mc."MENU_ID" = rd."REL_DET_ID"
          JOIN "OA_Module_Config" moc ON moc."MSTR_ID" = rd."CHILD_ID"
          WHERE pd."PERMISSIONS_REF_TYPE_ID" = 1614
            AND pd."PERMISSION_ENABLED" = 1
            AND pd."PERMISSIONS_CLASS_ID" = ${permissionsClassId}
            AND pd."OA_BRAND_ID" = ${oaBrandId}
            AND moc."OA_BRAND_ID" = ${oaBrandId}
            AND moc."IS_ENABLED" = true
            AND moc."IS_LICENSED" = true
            AND rd."PARENT_ID" = ${parentId}
            AND im."MSTR_CD" != ALL(${EXCLUDED_MSTR_CD_LIST}::text[])
            AND (
              im."APP_ID" = ${brandApplicationId}
              OR im."APP_ID" IS NULL
              OR im."APP_ID" = 0
            )
            AND mc."SHOW_MENU" = 1
        )
        SELECT "MENU_NAME", "REL_DET_ID", "CHILD_MSTR_ID", "URL", "SMALL_VIEW_ICON"
        FROM (
          SELECT DISTINCT ON ("MENU_NAME") *
          FROM matched
          ORDER BY "MENU_NAME", "SEQUENCE" ASC NULLS LAST, "REL_DET_ID" ASC
        ) deduped
        ORDER BY "SEQUENCE" ASC NULLS LAST, "MENU_NAME" ASC
      `;
}

/**
 * Recursively builds the full menu tree, one level at a time — same
 * recursion shape as left_menu_v.php calling get_menu_from_relationship()
 * again per module using $module['CHILD_MSTR_ID'] as the next parent_id.
 */
export async function getMenuTree(
  params: MenuQueryParams,
  depth = 0
): Promise<MenuNode[]> {
  if (depth >= MAX_DEPTH) return [];

  const rows = await queryMenuLevel(params);

  const nodes: MenuNode[] = await Promise.all(
    rows.map(async (row) => {
      const children =
        row.CHILD_MSTR_ID != null
          ? await getMenuTree({ ...params, parentId: row.CHILD_MSTR_ID }, depth + 1)
          : [];
      return {
        id: row.REL_DET_ID,
        name: row.MENU_NAME,
        childMstrId: row.CHILD_MSTR_ID,
        url: row.URL,
        smallViewIcon: row.SMALL_VIEW_ICON,
        children,
      };
    })
  );

  return nodes;
}