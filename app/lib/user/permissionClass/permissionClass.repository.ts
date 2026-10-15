import { prisma } from '@/lib/prisma';
import type { FunctionFlags, FunctionModule, FunctionNode, IdOption } from './types';

/**
 * Data access for Permission Class — the CI queries of permission_dtl_m, manager_m and
 * user_master_m, as parameterised PostgreSQL. MySQL's loose `GROUP BY im.MSTR_NM` (one arbitrary
 * row per name) is written as `DISTINCT ON (name)`, ordered so the lowest REL_DET_ID wins.
 */

/** CI PERMISSIONCLASS (const_helper.php): independent_mst.TYP_ID of permission classes. */
export const PERMISSION_CLASS_TYPE_ID = 49;
/** CI SYSTEMPERMISSIONTYPE: TYP_ID of the "Access Write" masters (Modify, Delete, Read, Print, Execute Process). */
export const SYSTEM_PERMISSION_TYPE_ID = 1;
/** CI PARENT_MENU_ID: root of the menu hierarchy. */
export const PARENT_MENU_ID = 370;
/** Menu codes CI never offers in the Function tab (front-end-only modules). */
const EXCLUDED_MODULE_CODES = ['CMFE', 'IMFE', 'FMSTM', 'OMFE'];

const ACTIVE = { OR: [{ IS_DELETED: false }, { IS_DELETED: null }] };

interface NodeRow {
  REL_DET_ID: number;
  CHILD_MSTR_ID: number | null;
  PARENT_HIER_ID: number | null;
  CHILD_NAME: string | null;
}

/**
 * CI manager_m::getAllModulesForPermission(): top-level modules. Super admin: every module;
 * others: only modules enabled + licensed for the brand and of the brand's application.
 */
async function modules(opts: { isSysAdmin: boolean; oaBrandId: number | null; appId: number }): Promise<NodeRow[]> {
  if (opts.isSysAdmin) {
    return prisma.$queryRaw<NodeRow[]>`
      SELECT * FROM (
        SELECT DISTINCT ON (im."MSTR_NM")
               rd."REL_DET_ID", rd."CHILD_MSTR_ID", rd."PARENT_HIER_ID", im."MSTR_NM" AS "CHILD_NAME"
        FROM relationship_dtl_vw rd
        LEFT JOIN config_mapping_dtl cm ON cm."SRC_ENTTY_ID" = rd."CHILD_MSTR_ID"
        LEFT JOIN independent_mst im ON im."MSTR_ID" = cm."TRGT_ENTTY_ID"
        WHERE rd."PARENT_HIER_ID" = ${PARENT_MENU_ID}
        ORDER BY im."MSTR_NM", rd."REL_DET_ID"
      ) m
      ORDER BY "CHILD_NAME"`;
  }
  return prisma.$queryRaw<NodeRow[]>`
    SELECT * FROM (
      SELECT DISTINCT ON (im."MSTR_NM")
             rd."REL_DET_ID", rd."CHILD_MSTR_ID", rd."PARENT_HIER_ID", im."MSTR_NM" AS "CHILD_NAME"
      FROM relationship_dtl_vw rd
      LEFT JOIN config_mapping_dtl cm ON cm."SRC_ENTTY_ID" = rd."CHILD_MSTR_ID"
      LEFT JOIN independent_mst im ON im."MSTR_ID" = cm."TRGT_ENTTY_ID"
      JOIN "OA_Module_Config" mc ON mc."MSTR_ID" = rd."CHILD_MSTR_ID"
      WHERE rd."PARENT_HIER_ID" = ${PARENT_MENU_ID}
        AND mc."IS_ENABLED" = true
        AND mc."IS_LICENSED" = true
        AND mc."OA_BRAND_ID" = ${opts.oaBrandId ?? -1}
        AND im."MSTR_CD" != ALL(${EXCLUDED_MODULE_CODES}::text[])
        AND (im."APP_ID" = ${opts.appId} OR im."APP_ID" IS NULL)
      ORDER BY im."MSTR_NM", rd."REL_DET_ID"
    ) m
    ORDER BY "CHILD_NAME"`;
}

/** CI permission_dtl_m::getAllEpicForPermission($parentId), for several parents at once. */
async function epics(parentIds: number[]): Promise<NodeRow[]> {
  if (parentIds.length === 0) return [];
  return prisma.$queryRaw<NodeRow[]>`
    SELECT * FROM (
      SELECT DISTINCT ON (rd."PARENT_HIER_ID", im."MSTR_NM")
             rd."REL_DET_ID", rd."CHILD_MSTR_ID", rd."PARENT_HIER_ID", im."MSTR_NM" AS "CHILD_NAME"
      FROM relationship_dtl_vw rd
      JOIN config_mapping_dtl cm ON cm."SRC_ENTTY_ID" = rd."CHILD_MSTR_ID"
      LEFT JOIN independent_mst im ON im."MSTR_ID" = cm."TRGT_ENTTY_ID"
      WHERE rd."PARENT_HIER_ID" = ANY(${parentIds}::int[])
      ORDER BY rd."PARENT_HIER_ID", im."MSTR_NM", rd."REL_DET_ID"
    ) e
    ORDER BY "PARENT_HIER_ID", "CHILD_NAME"`;
}

export const permissionClassRepository = {
  /** Modules with all their children (the CI form loaded every module's children on page load). */
  async functionTree(opts: { isSysAdmin: boolean; oaBrandId: number | null; appId: number }): Promise<FunctionModule[]> {
    const parents = (await modules(opts)).filter((m) => m.CHILD_NAME?.trim());
    const children = await epics(parents.flatMap((m) => (m.CHILD_MSTR_ID != null ? [m.CHILD_MSTR_ID] : [])));
    const byParent = new Map<number, FunctionNode[]>();
    for (const c of children) {
      if (c.PARENT_HIER_ID == null || !c.CHILD_NAME?.trim()) continue;
      const list = byParent.get(c.PARENT_HIER_ID) ?? [];
      list.push({ relDetId: Number(c.REL_DET_ID), name: c.CHILD_NAME.trim() });
      byParent.set(c.PARENT_HIER_ID, list);
    }
    return parents.map((m) => ({
      relDetId: Number(m.REL_DET_ID),
      name: (m.CHILD_NAME ?? '').trim(),
      childMstrId: m.CHILD_MSTR_ID,
      children: m.CHILD_MSTR_ID != null ? byParent.get(m.CHILD_MSTR_ID) ?? [] : [],
    }));
  },

  /** CI permission_dtl_m::get_enabled_module($classId, FUNP): REL_DET_ID → flags, in one brand. */
  async functionGrants(classId: number, oaBrandId: number, functionRefTypeId: number): Promise<Record<number, FunctionFlags>> {
    const rows = await prisma.permission_dtl.findMany({
      where: { PERMISSIONS_CLASS_ID: classId, PERMISSIONS_REF_TYPE_ID: functionRefTypeId, OA_BRAND_ID: oaBrandId },
      select: {
        PERMISSIONS_REF_ID: true,
        PERMISSION_ENABLED: true,
        PERMISSION_READ_ONLY: true,
        PERMISSION_MODIFY: true,
        PERMISSION_DELETE: true,
        PERMISSION_INSERT: true,
      },
    });
    const map: Record<number, FunctionFlags> = {};
    for (const r of rows) {
      if (r.PERMISSIONS_REF_ID == null) continue;
      map[r.PERMISSIONS_REF_ID] = {
        enabled: Number(r.PERMISSION_ENABLED) === 1,
        readonly: Number(r.PERMISSION_READ_ONLY) === 1,
        modify: Number(r.PERMISSION_MODIFY) === 1,
        delete: Number(r.PERMISSION_DELETE) === 1,
        insert: Number(r.PERMISSION_INSERT) === 1,
      };
    }
    return map;
  },

  /** CI getAllDataByPermissionClassID (non-function part): selected REF_IDs per ref type. */
  async refSelections(classId: number, oaBrandId: number, refTypeIds: number[]): Promise<Map<number, number[]>> {
    const rows = await prisma.permission_dtl.findMany({
      where: { PERMISSIONS_CLASS_ID: classId, OA_BRAND_ID: oaBrandId, PERMISSIONS_REF_TYPE_ID: { in: refTypeIds } },
      select: { PERMISSIONS_REF_TYPE_ID: true, PERMISSIONS_REF_ID: true },
    });
    const map = new Map<number, number[]>();
    for (const r of rows) {
      if (r.PERMISSIONS_REF_TYPE_ID == null || r.PERMISSIONS_REF_ID == null) continue;
      const list = map.get(r.PERMISSIONS_REF_TYPE_ID) ?? [];
      if (!list.includes(r.PERMISSIONS_REF_ID)) list.push(r.PERMISSIONS_REF_ID);
      map.set(r.PERMISSIONS_REF_TYPE_ID, list);
    }
    return map;
  },

  /** CI permission_dtl_m::getuserId($classId, $oaBrandID): USER_ID of the class's first row. */
  async classUserId(classId: number, oaBrandId: number): Promise<number | null> {
    const row = await prisma.permission_dtl.findFirst({
      where: { PERMISSIONS_CLASS_ID: classId, OA_BRAND_ID: oaBrandId },
      select: { USER_ID: true },
      orderBy: { PERMISSIONS_DTL_ID: 'asc' },
    });
    return row?.USER_ID ?? null;
  },

  /** The class master (independent_mst, TYP_ID 49). CI getPermissionsClass read permission_class_mst_vw. */
  async findClass(classId: number): Promise<{ id: number; name: string } | null> {
    const row = await prisma.independent_mst.findFirst({
      where: { MSTR_ID: classId, TYP_ID: PERMISSION_CLASS_TYPE_ID, ...ACTIVE },
      select: { MSTR_ID: true, MSTR_NM: true },
      orderBy: { MSTR_ID: 'asc' },
    });
    return row ? { id: row.MSTR_ID, name: (row.MSTR_NM ?? '').trim() } : null;
  },

  /** CI permission_dtl_m::getAllPermissionClassForSearch($q): classes whose name contains q. */
  async searchClasses(q: string, limit = 20): Promise<IdOption[]> {
    const rows = await prisma.independent_mst.findMany({
      where: {
        TYP_ID: PERMISSION_CLASS_TYPE_ID,
        ...ACTIVE,
        ...(q ? { MSTR_NM: { contains: q, mode: 'insensitive' } } : {}),
      },
      select: { MSTR_ID: true, MSTR_NM: true },
      orderBy: [{ MSTR_NM: 'asc' }, { MSTR_ID: 'asc' }],
      take: limit * 3,
    });
    const seen = new Set<number>();
    return rows
      .filter((r) => (seen.has(r.MSTR_ID) ? false : (seen.add(r.MSTR_ID), true)))
      .slice(0, limit)
      .map((r) => ({ value: r.MSTR_ID, label: (r.MSTR_NM ?? '').trim() }));
  },

  /** CI getDataByTypeID(SYSTEMPERMISSIONTYPE = 1): the "Access Write" checkboxes. */
  async accessOptions(): Promise<IdOption[]> {
    const rows = await prisma.independent_mst.findMany({
      where: { TYP_ID: SYSTEM_PERMISSION_TYPE_ID, ...ACTIVE },
      select: { MSTR_ID: true, MSTR_NM: true },
      orderBy: { MSTR_ID: 'asc' },
    });
    const seen = new Set<number>();
    return rows
      .filter((r) => (seen.has(r.MSTR_ID) ? false : (seen.add(r.MSTR_ID), true)))
      .map((r) => ({ value: r.MSTR_ID, label: (r.MSTR_NM ?? '').trim() }));
  },

  /** CI rePopulate(): the class's access rows (PERMISSIONS_REF_TYPE_ID NULL, PERMISSIONS_ID set). */
  async accessSelections(classId: number, oaBrandId: number): Promise<number[]> {
    const rows = await prisma.permission_dtl.findMany({
      where: { PERMISSIONS_CLASS_ID: classId, OA_BRAND_ID: oaBrandId, PERMISSIONS_REF_TYPE_ID: null, NOT: { PERMISSIONS_ID: null } },
      select: { PERMISSIONS_ID: true },
    });
    return [...new Set(rows.flatMap((r) => (r.PERMISSIONS_ID != null ? [r.PERMISSIONS_ID] : [])))];
  },

  /** CI oa_brands_m::dependableUserBasedOnOrgBrand($brand): the "Requested By" users of a brand. */
  async brandUsers(oaBrandId: number): Promise<IdOption[]> {
    const rows = await prisma.user_mst.findMany({
      where: { OA_BRAND_ID: oaBrandId, ...ACTIVE },
      select: { USER_ID: true, USER_NAME: true },
      orderBy: [{ USER_NAME: 'asc' }, { USER_ID: 'asc' }],
      take: 5000,
    });
    const seen = new Set<number>();
    return rows
      .filter((r) => (seen.has(r.USER_ID) ? false : (seen.add(r.USER_ID), true)))
      .map((r) => ({ value: r.USER_ID, label: r.USER_NAME }));
  },

  /**
   * CI user_master_m::getAllUsersForOaId / getAllRolesForOaId / getAllUserGroupsForOaId.
   * CI filtered users by `user_mst.DMN_ID = <organisation id>` (a domain id compared with an org id);
   * here users, roles and groups are all filtered by their OA_ID.
   */
  async orgRefOptions(oaId: number): Promise<{ users: IdOption[]; roles: IdOption[]; userGroups: IdOption[] }> {
    const [users, roles, groups] = await Promise.all([
      prisma.user_mst.findMany({
        where: { OA_ID: oaId, ...ACTIVE },
        select: { USER_ID: true, USER_NAME: true },
        orderBy: [{ USER_NAME: 'asc' }, { USER_ID: 'asc' }],
        take: 5000,
      }),
      prisma.role_mst.findMany({
        where: { OA_ID: oaId, ...ACTIVE },
        select: { ROLE_ID: true, ROLE_NM: true },
        orderBy: [{ ROLE_NM: 'asc' }, { ROLE_ID: 'asc' }],
        take: 5000,
      }),
      prisma.user_group.findMany({
        where: { OA_ID: oaId, ...ACTIVE },
        select: { USER_GRP_ID: true, USER_GRP_NM: true },
        orderBy: [{ USER_GRP_NM: 'asc' }, { USER_GRP_ID: 'asc' }],
        take: 5000,
      }),
    ]);
    const unique = (list: IdOption[]) => {
      const seen = new Set<number>();
      return list.filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)));
    };
    return {
      users: unique(users.map((u) => ({ value: u.USER_ID, label: u.USER_NAME }))),
      roles: unique(roles.map((r) => ({ value: r.ROLE_ID, label: r.ROLE_NM }))),
      userGroups: unique(groups.map((g) => ({ value: g.USER_GRP_ID, label: g.USER_GRP_NM }))),
    };
  },
};
