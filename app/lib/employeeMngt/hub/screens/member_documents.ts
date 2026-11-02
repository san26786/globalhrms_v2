import { getMasterId } from '@/lib/masters/masterService';
import { prisma } from '@/lib/prisma';
import { commonTypeId } from '@/lib/systmMngt/shared';
import { memberDocumentsDefs } from '../defs/member_documents';
import { insertRow, type DbValue, type HubConfig, type HubContext, type HubOptionList, type Tx } from '../hubEngine';
import { keepCurrent, masterLabel } from '../hubOptions';

/**
 * CI employeeMngt/member_documents ("Member Documents"): an employee's documents — member_attachment
 * rows of document type DTMD owned by the employee's login user (USER_ID) in the brand, the files in
 * MEMBER_ATTACHMENT_DIR (CI's public folder uploads/member_attachment/, shared with Company Documents).
 * A user group shares the document (member_attachment_dtl, one row per group member).
 *
 * Behaviour changes: files download only for users who may see the record (CI served the folder to anyone
 * and its download / view links took any id); 20 MB at most (CI: no limit); the status (Public with a
 * group, else Private) and the group's member rows follow the group on edit (CI left them stale and
 * wiped the status); the record is tied to the employee (EMPLOYEE_ID) on every save; company documents
 * are no longer listed here. Not migrated: CI's appointment / offer / confirmation letter buttons (never
 * used; their code was broken) and the DMS push.
 */
const DOC_STATUS_TYPE = 214;

async function documentType(code: 'DTMD' | 'DTCD') {
  return getMasterId(code);
}

/** CI getMastersByCategory: the categories of member documents and their sub-categories. */
async function categoryOptions(): Promise<{ categories: HubOptionList; subCategories: HubOptionList }> {
  const memberDocs = await documentType('DTMD');
  const rows = await prisma.$queryRaw<Array<{ value: number; label: string; parent: number }>>`
    SELECT im."MSTR_ID" AS value, im."MSTR_NM" AS label, im."PARENT_MSTR_ID" AS parent FROM independent_mst im
    WHERE COALESCE(im."IS_DELETED", false) = false
      AND (im."PARENT_MSTR_ID" = ${memberDocs ?? -1}
           OR im."PARENT_MSTR_ID" IN (SELECT c."MSTR_ID" FROM independent_mst c WHERE c."PARENT_MSTR_ID" = ${memberDocs ?? -1}
                                       AND COALESCE(c."IS_DELETED", false) = false))
    ORDER BY im."SEQUENCE" NULLS LAST, im."MSTR_NM"`;
  const categories = rows.filter((r) => Number(r.parent) === memberDocs).map((r) => ({ value: Number(r.value), label: r.label }));
  const subCategories = rows.filter((r) => Number(r.parent) !== memberDocs).map((r) => ({ value: Number(r.value), label: r.label, parent: Number(r.parent) }));
  return { categories, subCategories };
}

/** CI getAllUserGroup(): the user groups of the employee's organisation. */
async function userGroupOptions(brand: number | null) {
  const rows = await prisma.$queryRaw<Array<{ value: number; label: string }>>`
    SELECT DISTINCT ON (g."USER_GRP_ID") g."USER_GRP_ID" AS value, g."USER_GRP_NM" AS label FROM user_group g
    WHERE COALESCE(g."IS_DELETED", false) = false
      AND g."OA_ID" = (SELECT b."OA_ID" FROM oa_brands b WHERE b."OA_BRAND_ID" = ${brand ?? -1} LIMIT 1)
    ORDER BY g."USER_GRP_ID"`;
  return rows.map((r) => ({ value: Number(r.value), label: r.label })).sort((a, b) => a.label.localeCompare(b.label));
}

async function groupLabel(id: number): Promise<string | null> {
  const row = await prisma.user_group.findFirst({ where: { USER_GRP_ID: id }, select: { USER_GRP_NM: true } });
  return row?.USER_GRP_NM ?? null;
}

/** member_attachment_dtl: one row per member of the document's group (replaced when the group changes). */
async function shareWithGroup(tx: Tx, id: number, group: number | null, status: number | null, ctx: HubContext) {
  const { employee, subject } = ctx;
  await tx.$executeRaw`
    UPDATE member_attachment_dtl SET "IS_DELETED" = 1, "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now()
    WHERE "MEMBER_ATTACHMENT_ID" = ${id} AND COALESCE("IS_DELETED", 0) = 0`;
  if (!group) return;
  const members = await tx.$queryRaw<Array<{ user: number }>>`
    SELECT DISTINCT "USER_ID" AS "user" FROM user_group_dtl WHERE "USER_GRP_ID" = ${group} AND COALESCE("IS_DELETED", 0) = 0 AND "USER_ID" IS NOT NULL`;
  for (const m of members) {
    await insertRow(tx, 'member_attachment_dtl', 'MEMBER_ATTACHMENT_DTL_ID', {
      MEMBER_ATTACHMENT_ID: id, USER_GRP_ID: group, STATUS_ID: status ?? 0, USER_ID: m.user,
      OA_ID: employee.oaId ?? 0, OA_BRAND_ID: employee.brand,
    }, subject.userId);
  }
}

export const memberDocumentsConfig: HubConfig = {
  key: 'member_documents',
  defs: memberDocumentsDefs,
  table: 'member_attachment',
  pk: 'ID',
  empColumn: 'EMPLOYEE_ID',
  // The employee is the one whose login user owns the document in its brand (EMPLOYEE_ID is empty on old rows).
  from: `member_attachment t JOIN emp_mst em ON em."REF_EMP_ID" = t."USER_ID" AND em."OA_BRAND_ID" = t."OA_BRAND_ID"`,
  alive: `NOT t."IS_DELETED" AND t."DOC_TYPE_ID" IS DISTINCT FROM (SELECT "MSTR_ID" FROM independent_mst WHERE "MSTR_CD" = 'DTCD' ORDER BY "MSTR_ID" LIMIT 1)`,
  listColumns: `t."FILENAME", NULLIF(t."IMAGENAME", '') AS "IMAGENAME",
    (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = NULLIF(t."DOC_CATEGORY_ID", 0) LIMIT 1) AS "DOC_CATEGORY",
    (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = NULLIF(t."DOC_SUB_CATEGORY_ID", 0) LIMIT 1) AS "DOC_SUB_CATEGORY",
    (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = NULLIF(t."DOC_STATUS_ID", 0) LIMIT 1) AS "DOC_STATUS",
    (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = t."DOC_TYPE_ID" LIMIT 1) AS "DOC_TYPE",
    (SELECT g."USER_GRP_NM" FROM user_group g WHERE g."USER_GRP_ID" = NULLIF(t."USER_GROUP_ID", 0) LIMIT 1) AS "USER_GROUP",
    CASE WHEN t."IS_PUBLIC" = 1 THEN 'Yes' ELSE 'No' END AS "IS_PUBLIC", to_char(t."CREATED_ON", 'YYYY-MM-DD') AS "CREATED_ON"`,
  search: ['FILENAME', 'IMAGENAME', 'DOC_CATEGORY', 'DOC_SUB_CATEGORY', 'USER_GROUP', 'DOC_TYPE'],
  sorts: ['FILENAME', 'DOC_CATEGORY', 'DOC_TYPE', 'CREATED_ON'],
  bind: { docCategory: 'DOC_CATEGORY_ID', docSubCategory: 'DOC_SUB_CATEGORY_ID', fileName: 'FILENAME', isPublic: 'IS_PUBLIC', userGroup: 'USER_GROUP_ID' },
  deleteMode: 'soft',
  messages: { created: 'Successfully Added Member Document', updated: 'Successfully Updated Member Document Details', deleted: 'Successfully Deleted' },

  attachment: {
    column: 'IMAGENAME',
    store: {
      envVar: 'MEMBER_ATTACHMENT_DIR',
      allowed: new Set(['docx', 'doc', 'xlsx', 'xls', 'pdf', 'txt', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'jfif', 'tiff']),
      maxBytes: 20 * 1024 * 1024,
      maxNameLength: 250,
    },
    // CI: {brand code}_{user id}_{original name}
    async prefix(_id, employee) {
      const brand = await prisma.oa_brands.findFirst({ where: { OA_BRAND_ID: employee.brand }, select: { OA_BRAND_CD: true } });
      return `${brand?.OA_BRAND_CD ?? employee.brand}_${employee.userId ?? 0}_`;
    },
    required: true,
  },

  options: async (_subject, brand, row) => {
    const [{ categories, subCategories }, groups] = await Promise.all([categoryOptions(), userGroupOptions(brand)]);
    return {
      categories: await keepCurrent(categories, row?.DOC_CATEGORY_ID, masterLabel),
      subCategories: await keepCurrent(subCategories, row?.DOC_SUB_CATEGORY_ID, masterLabel),
      userGroups: await keepCurrent(groups, row?.USER_GROUP_ID, groupLabel),
    };
  },

  read(_row, values) {
    for (const key of ['docCategory', 'docSubCategory', 'userGroup']) if (values[key] === '0') values[key] = '';
  },

  validate(_v, check, ctx) {
    if (!ctx.employee.userId) check.fail('EMP_ID', 'This employee has no user account, so a document cannot be linked to them.');
  },

  async extraColumns(v, ctx): Promise<Record<string, DbValue>> {
    const entityType = await commonTypeId('CDT'); // CI's entity type for member documents too
    const status = await getMasterId(v.userGroup ? 'PU' : 'PR', { typeId: DOC_STATUS_TYPE });
    const extra: Record<string, DbValue> = {
      TYPE: '1', DOC_STATUS_ID: status, LINKED_SYSTEM_ENTITY_TYPE_ID: entityType, EMP_ID: ctx.employee.code,
      DOC_CATEGORY_ID: v.docCategory ? Number(v.docCategory) : 0,
    };
    if (!ctx.id) extra.DOC_TYPE_ID = await documentType('DTMD');
    return extra;
  },

  async afterWrite(tx, id, v, ctx) {
    if (ctx.existing && v.userGroup === ctx.existing.userGroup) return;
    const status = await getMasterId(v.userGroup ? 'PU' : 'PR', { typeId: DOC_STATUS_TYPE });
    await shareWithGroup(tx, id, v.userGroup ? Number(v.userGroup) : null, status, ctx);
  },

  async remove(tx, ctx) {
    const { subject } = ctx;
    await tx.$executeRaw`
      UPDATE member_attachment SET "IS_DELETED" = true, "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = CURRENT_DATE WHERE "ID" = ${ctx.id!}`;
    await tx.$executeRaw`
      UPDATE member_attachment_dtl SET "IS_DELETED" = 1, "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now()
      WHERE "MEMBER_ATTACHMENT_ID" = ${ctx.id!} AND COALESCE("IS_DELETED", 0) = 0`;
  },
};
