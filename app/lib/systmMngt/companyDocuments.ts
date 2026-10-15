import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { NotFoundError, ServiceUnavailableError, ValidationError } from '@/lib/http/errors';
import { getMasterId } from '@/lib/masters/masterService';
import { prisma } from '@/lib/prisma';
import { activeBrand, authorize, brandOrgId, commonTypeId, type IdLabel } from './shared';

/**
 * CI systmMngt/company_documents (list + delete) and its add / edit form, which CI served from
 * user/member_file_upload/{new|edit}FileUpload/.../BRAND_ID: member_attachment rows of system entity
 * type CDT ("Company Document"), document type DTCD, one uploaded file each, optionally shared with
 * a user group (member_attachment_dtl gets one row per group member, as in CI).
 *
 * Files: CI wrote them to its public folder uploads/member_attachment/ (served to anyone). Here they
 * go to MEMBER_ATTACHMENT_DIR (point it at that CI folder, or a copy) and are downloaded through an
 * authenticated, brand-checked route. File name as CI: {brand code}_{user id}_{original name}
 * (spaces removed; a numeric suffix when the name is taken — CI did not overwrite either).
 *
 * Behaviour changes:
 *  - brand-scoped edit / delete (CI deleted any member_attachment id); delete is a soft delete of the
 *    document and its group rows (CI hard-deleted the document and left the group rows and the file);
 *  - with no user group the document is still saved (CI saved nothing yet reported success);
 *  - DOC_STATUS_ID is recomputed on edit (CI posted a field the form never had, so it became NULL);
 *  - uploads are limited to 20 MB (CI: no limit); the DMS SOAP push of CI's form script is not ported.
 * Raw SQL: member_attachment's text / audit columns hold NULLs the Prisma model declares required.
 */

const MENU = 'systmMngt/company_documents';
const ALLOWED = new Set(['docx', 'doc', 'xlsx', 'xls', 'pdf', 'txt', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'jfif', 'tiff']);
const MAX_BYTES = 20 * 1024 * 1024;

export interface CompanyDocumentValues {
  fileName: string;
  docCategory: string;
  master: string;
  isPublic: boolean;
  userGroup: string;
  imageName: string;
}

export interface CompanyDocumentInit {
  title: string;
  mode: 'add' | 'edit';
  values: CompanyDocumentValues | null;
  docType: IdLabel | null;
  categories: IdLabel[];
  userGroups: IdLabel[];
  allowedExtensions: string[];
}

function storageDir(): string {
  const dir = process.env.MEMBER_ATTACHMENT_DIR?.trim();
  if (!dir) {
    throw new ServiceUnavailableError(
      'Document storage is not configured: set MEMBER_ATTACHMENT_DIR to the folder for uploaded documents.',
      'STORAGE_NOT_CONFIGURED',
    );
  }
  return dir;
}

/** CI getAllIndMstByParentMstrCode(parentId): child masters (categories / sub categories). */
export async function childMasters(parentId: number): Promise<IdLabel[]> {
  const rows = await prisma.$queryRaw<Array<{ value: number; label: string }>>`
    SELECT DISTINCT ON ("MSTR_ID") "MSTR_ID" AS value, "MSTR_NM" AS label, "SEQUENCE"
    FROM independent_mst WHERE "PARENT_MSTR_ID" = ${parentId} AND COALESCE("IS_DELETED", false) = false
    ORDER BY "MSTR_ID"`;
  return rows.map((r) => ({ value: Number(r.value), label: r.label })).sort((a, b) => a.label.localeCompare(b.label));
}

/** CI member_file_upload_m::getAllUserGroup(): the organisation's groups (all for sysadmin). */
async function userGroups(subject: RequestSubject): Promise<IdLabel[]> {
  const rows = await prisma.$queryRaw<Array<{ value: number; label: string }>>`
    SELECT DISTINCT ON ("USER_GRP_ID") "USER_GRP_ID" AS value, "USER_GRP_NM" AS label FROM user_group
    WHERE COALESCE("IS_DELETED", false) = false AND (${subject.adminLevel === 2} OR "OA_ID" = ${subject.oaId ?? -1})
    ORDER BY "USER_GRP_ID"`;
  return rows.map((r) => ({ value: Number(r.value), label: r.label })).sort((a, b) => a.label.localeCompare(b.label));
}

interface Row {
  ID: number;
  FILENAME: string | null;
  IMAGENAME: string | null;
  DOC_CATEGORY_ID: number | null;
  DOC_SUB_CATEGORY_ID: number | null;
  IS_PUBLIC: number | null;
  USER_GROUP_ID: number | null;
}

async function findDocument(id: number, brand: number): Promise<Row | null> {
  const entityType = await commonTypeId('CDT');
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT "ID", "FILENAME", "IMAGENAME", "DOC_CATEGORY_ID", "DOC_SUB_CATEGORY_ID", "IS_PUBLIC", "USER_GROUP_ID"
    FROM member_attachment
    WHERE "ID" = ${id} AND "OA_BRAND_ID" = ${brand} AND "LINKED_SYSTEM_ENTITY_TYPE_ID" = ${entityType}
      AND COALESCE("IS_DELETED", false) = false
    LIMIT 1`;
  return rows[0] ?? null;
}

/** CI upload(): {brand code}_{user}_{original}, spaces removed, numeric suffix when taken. */
async function storeFile(file: File, brand: number, userId: number): Promise<string> {
  const original = path.basename(file.name).replace(/\s+/g, '');
  const ext = path.extname(original).slice(1).toLowerCase();
  if (!ALLOWED.has(ext)) throw new ValidationError('The filetype you are attempting to upload is not allowed.', { userfile: ['File type not allowed.'] });
  if (file.size > MAX_BYTES) throw new ValidationError('The file you are attempting to upload is larger than 20 MB.', { userfile: ['File too large.'] });

  const dir = storageDir();
  await mkdir(dir, { recursive: true });
  const brandRow = await prisma.oa_brands.findFirst({ where: { OA_BRAND_ID: brand }, select: { OA_BRAND_CD: true } });
  const safe = original.replace(/[^A-Za-z0-9._-]/g, '_');
  const base = `${brandRow?.OA_BRAND_CD ?? brand}_${userId}_${safe.slice(0, safe.length - ext.length - 1)}`;
  for (let i = 0; i < 1000; i++) {
    const name = `${base}${i ? i : ''}.${ext}`;
    try {
      await access(path.join(dir, name));
    } catch {
      await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()), { flag: 'wx' });
      return name;
    }
  }
  throw new ValidationError('Could not store the file: too many files with this name.');
}

const saveSchema = z.object({
  fileName: z.string({ error: 'The File Name field is required.' }).trim().min(1, 'The File Name field is required.').max(250),
  docCategory: z.preprocess((v) => (v === '' || v == null ? null : v), z.coerce.number().int().positive().nullable()),
  master: z.preprocess((v) => (v === '' || v == null ? null : v), z.coerce.number().int().positive().nullable()),
  isPublic: z.preprocess((v) => v === 'true' || v === '1' || v === true, z.boolean()),
  userGroup: z.preprocess((v) => (v === '' || v == null ? null : v), z.coerce.number().int().positive().nullable()),
});

/** Master type of the document statuses Public (PU) / Private (PR). */
const DOC_STATUS_TYPE_ID = 214;

/**
 * CI DOC_STATUS_ID: Public (PU) when shared with a group, else Private (PR). CI looked PR up without
 * its type, and 'PR' is also Puerto Rico (61) and Read (68) — the type pins it to Private.
 */
async function docStatus(hasGroup: boolean): Promise<number | null> {
  return getMasterId(hasGroup ? 'PU' : 'PR', { typeId: DOC_STATUS_TYPE_ID });
}

export const companyDocumentsService = {
  async formInit(subject: RequestSubject, id: number | null): Promise<CompanyDocumentInit> {
    await authorize(subject, MENU, id ? 'update' : 'create');
    const brand = activeBrand(subject);
    const row = id ? await findDocument(id, brand) : null;
    if (id && !row) throw new NotFoundError('Company document not found.');
    const docTypeId = await getMasterId('DTCD');
    const [categories, groups, docTypeName] = await Promise.all([
      docTypeId ? childMasters(docTypeId) : Promise.resolve([]),
      userGroups(subject),
      docTypeId
        ? prisma.independent_mst.findFirst({ where: { MSTR_ID: docTypeId }, select: { MSTR_NM: true } })
        : Promise.resolve(null),
    ]);
    const s = (v: number | null) => (v === null ? '' : String(v));
    return {
      title: row ? 'Edit Policy Document Type' : 'Add Policy Document',
      mode: row ? 'edit' : 'add',
      values: row
        ? {
            fileName: row.FILENAME ?? '',
            docCategory: s(row.DOC_CATEGORY_ID),
            master: s(row.DOC_SUB_CATEGORY_ID),
            isPublic: row.IS_PUBLIC === 1,
            userGroup: s(row.USER_GROUP_ID),
            imageName: row.IMAGENAME ?? '',
          }
        : null,
      docType: docTypeId ? { value: docTypeId, label: docTypeName?.MSTR_NM ?? 'Company Document' } : null,
      categories,
      userGroups: groups,
      allowedExtensions: [...ALLOWED],
    };
  },

  /** CI member_file_upload insert / update (BRAND_ID path). `form` is the multipart body. */
  async save(subject: RequestSubject, id: number | null, form: FormData): Promise<{ message: string; id: number }> {
    await authorize(subject, MENU, id ? 'update' : 'create');
    const brand = activeBrand(subject);
    const existing = id ? await findDocument(id, brand) : null;
    if (id && !existing) throw new NotFoundError('Company document not found.');

    const v = saveSchema.parse({
      fileName: form.get('fileName'),
      docCategory: form.get('docCategory'),
      master: form.get('master'),
      isPublic: form.get('isPublic'),
      userGroup: form.get('userGroup'),
    });
    const file = form.get('userfile');
    const upload = file instanceof File && file.size > 0 ? file : null;
    if (!upload && !existing?.IMAGENAME) {
      throw new ValidationError('The Upload File field is required.', { userfile: ['The Upload File field is required.'] });
    }

    const [docType, entityType, status] = await Promise.all([getMasterId('DTCD'), commonTypeId('CDT'), docStatus(v.userGroup !== null)]);
    if (!id) await assertInsertSafe('member_attachment', 'ID');
    const imageName = upload ? await storeFile(upload, brand, subject.userId) : existing!.IMAGENAME!;
    const oaId = await brandOrgId(brand, subject.oaId);

    if (existing) {
      await prisma.$executeRaw`
        UPDATE member_attachment SET "FILENAME" = ${v.fileName}, "IMAGENAME" = ${imageName},
          "DOC_CATEGORY_ID" = ${v.docCategory}, "DOC_SUB_CATEGORY_ID" = ${v.master}, "IS_PUBLIC" = ${v.isPublic ? 1 : 0},
          "TYPE" = '1', "USER_GROUP_ID" = ${v.userGroup}, "LINKED_SYSTEM_ENTITY_TYPE_ID" = ${entityType},
          "DOC_STATUS_ID" = ${status}, "DOC_TYPE_ID" = ${docType}, "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = CURRENT_DATE
        WHERE "ID" = ${existing.ID} AND "OA_BRAND_ID" = ${brand}`;
      return { message: 'Successfully Updated Member Document Details', id: existing.ID };
    }

    const members = v.userGroup
      ? await prisma.$queryRaw<Array<{ USER_ID: number }>>`
          SELECT DISTINCT "USER_ID" FROM user_group_dtl WHERE "USER_GRP_ID" = ${v.userGroup} AND COALESCE("IS_DELETED", 0) = 0`
      : [];
    if (members.length) await assertInsertSafe('member_attachment_dtl', 'MEMBER_ATTACHMENT_DTL_ID');

    const newId = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: number }>>`
        INSERT INTO member_attachment ("FILENAME", "IMAGENAME", "DOC_CATEGORY_ID", "DOC_SUB_CATEGORY_ID", "IS_PUBLIC", "TYPE",
          "USER_GROUP_ID", "LINKED_SYSTEM_ENTITY_TYPE_ID", "DOC_STATUS_ID", "DOC_TYPE_ID", "OA_ID", "OA_BRAND_ID", "USER_ID",
          "CREATED_BY", "CREATED_ON")
        VALUES (${v.fileName}, ${imageName}, ${v.docCategory}, ${v.master}, ${v.isPublic ? 1 : 0}, '1', ${v.userGroup}, ${entityType},
          ${status}, ${docType}, ${oaId}, ${brand}, ${subject.userId}, ${subject.userId}, CURRENT_DATE)
        RETURNING "ID" AS id`;
      const attachmentId = Number(rows[0].id);
      for (const m of members) {
        await tx.$executeRaw`
          INSERT INTO member_attachment_dtl ("MEMBER_ATTACHMENT_ID", "USER_GRP_ID", "STATUS_ID", "USER_ID", "OA_ID", "OA_BRAND_ID",
            "CREATED_BY", "CREATED_ON")
          VALUES (${attachmentId}, ${v.userGroup}, ${status}, ${m.USER_ID}, ${oaId}, ${brand}, ${subject.userId}, now())`;
      }
      return attachmentId;
    });
    return { message: 'Successfully Added Company Document', id: newId };
  },

  async remove(subject: RequestSubject, id: number): Promise<{ message: string }> {
    await authorize(subject, MENU, 'delete');
    const brand = activeBrand(subject);
    if (!(await findDocument(id, brand))) throw new NotFoundError('Company document not found.');
    await prisma.$transaction([
      prisma.$executeRaw`UPDATE member_attachment SET "IS_DELETED" = true, "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = CURRENT_DATE
                         WHERE "ID" = ${id} AND "OA_BRAND_ID" = ${brand}`,
      prisma.$executeRaw`UPDATE member_attachment_dtl SET "IS_DELETED" = 1, "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now()
                         WHERE "MEMBER_ATTACHMENT_ID" = ${id} AND "OA_BRAND_ID" = ${brand}`,
    ]);
    return { message: 'Successfully Deleted Company Docuement' };
  },

  /** The document's file (CI linked uploads/member_attachment/{IMAGENAME} publicly). */
  async file(subject: RequestSubject, id: number): Promise<{ name: string; data: Buffer }> {
    await authorize(subject, MENU, 'list');
    const row = await findDocument(id, activeBrand(subject));
    if (!row?.IMAGENAME) throw new NotFoundError('Document not found.');
    const name = path.basename(row.IMAGENAME); // no path traversal from stored names
    try {
      return { name, data: await readFile(path.join(storageDir(), name)) };
    } catch (e) {
      if (e instanceof ServiceUnavailableError) throw e;
      throw new NotFoundError('Document Not Found!!');
    }
  },

  /** CI getMastersByCategory/{id}: sub categories of a category (form cascade). */
  async subCategories(subject: RequestSubject, categoryId: number): Promise<IdLabel[]> {
    await authorize(subject, MENU, 'list');
    return childMasters(categoryId);
  },

  /** CI list filter: LINKED_SYSTEM_ENTITY_TYPE_ID = typeId('CDT'). */
  async listScope() {
    const entityType = await commonTypeId('CDT');
    return { equals: [{ column: 'LINKED_SYSTEM_ENTITY_TYPE_ID', value: entityType ?? -1 }] };
  },
};
