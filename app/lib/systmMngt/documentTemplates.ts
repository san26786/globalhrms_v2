import { z } from 'zod';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/http/errors';
import { getMasterCode } from '@/lib/masters/masterService';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { activeBrand, authorize, brandOrgId, commonTypeId, mastersOfTypeCode, sanitizeHtml, type IdLabel } from './shared';

/**
 * CI systmMngt/document_template (template bodies: HTML with **VARIABLE** placeholders, one per
 * template and brand) and systmMngt/document_templates_variables (which view column fills each
 * placeholder). Lists: document_template_vw / document_templates_variables_vw (prisma/sql/views).
 *
 * Behaviour changes:
 *  - brand-scoped: edit / update / delete only the active brand's rows (CI: any id), and org / brand /
 *    user are the session's (CI took them from posted hidden fields, unchecked for variables);
 *  - the body is cleaned of scripts, event handlers, xmlns and javascript: links (CI kept `style` and
 *    stripped on* / xmlns on these URLs — style is still kept);
 *  - the variable's view and column must exist in the entity catalogue (CI concatenated the view name
 *    from the URL into SQL and stored any posted column) — this also closes the SQL injection;
 *  - editing the template uniqueness check excludes the template itself (CI too) and ignores
 *    deleted rows; audit columns are stamped on variables (CI left them empty).
 * Raw SQL: audit columns hold NULLs the Prisma models declare required.
 */

const TEMPLATE_MENU = 'systmMngt/document_template';
const VARIABLE_MENU = 'systmMngt/document_templates_variables';

/* ------------------------------------------------------------------ document_template */

export interface DocumentTemplateInit {
  title: string;
  mode: 'add' | 'edit';
  values: { template_id: string; template_body: string } | null;
  templates: IdLabel[];
}

async function templateRow(id: number, brand: number) {
  const rows = await prisma.$queryRaw<Array<{ ID: number; TEMPLATE_ID: number | null; TEMPLATE_BODY: string | null }>>`
    SELECT "ID", "TEMPLATE_ID", "TEMPLATE_BODY" FROM document_template
    WHERE "ID" = ${id} AND "OA_BRAND_ID" = ${brand} AND COALESCE("IS_DELETED", 0) = 0 LIMIT 1`;
  return rows[0] ?? null;
}

const templateSchema = z.object({
  template_id: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.coerce.number({ error: 'The Template_id field is required.' }).int().positive('The Template_id field is required.'),
  ),
  template_body: z.preprocess((v) => (typeof v === 'string' ? v : ''), z.string().max(2_000_000, 'The template body is too large.')),
});

export const documentTemplateService = {
  async formInit(subject: RequestSubject, id: number | null): Promise<DocumentTemplateInit> {
    await authorize(subject, TEMPLATE_MENU, id ? 'update' : 'create');
    const brand = activeBrand(subject);
    const row = id ? await templateRow(id, brand) : null;
    if (id && !row) throw new NotFoundError('Document template not found.');
    return {
      title: row ? 'Edit Document Template' : 'New Document Template',
      mode: row ? 'edit' : 'add',
      values: row ? { template_id: row.TEMPLATE_ID ? String(row.TEMPLATE_ID) : '', template_body: row.TEMPLATE_BODY ?? '' } : null,
      templates: await mastersOfTypeCode('DTN'), // CI getAllDocumentTemplates(): independent_mst type DTN
    };
  },

  async save(subject: RequestSubject, id: number | null, body: unknown): Promise<{ message: string; id: number }> {
    await authorize(subject, TEMPLATE_MENU, id ? 'update' : 'create');
    const brand = activeBrand(subject);
    if (id && !(await templateRow(id, brand))) throw new NotFoundError('Document template not found.');
    const v = templateSchema.parse(body);

    // CI checkTemplateExists: one body per template and brand.
    const dup = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(*) AS n FROM document_template
      WHERE "TEMPLATE_ID" = ${v.template_id} AND "OA_BRAND_ID" = ${brand} AND "ID" <> ${id ?? 0} AND COALESCE("IS_DELETED", 0) = 0`;
    if (Number(dup[0]?.n ?? 0) > 0) {
      const message = 'Template with Body already Exists !! Please Edit/Update if you want change template body';
      throw new ConflictError(message, { template_id: [message] });
    }

    const html = sanitizeHtml(v.template_body);
    if (id) {
      await prisma.$executeRaw`
        UPDATE document_template SET "TEMPLATE_ID" = ${v.template_id}, "TEMPLATE_BODY" = ${html},
          "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now()
        WHERE "ID" = ${id} AND "OA_BRAND_ID" = ${brand}`;
      return { message: 'Successfully Updated', id };
    }
    await assertInsertSafe('document_template', 'ID');
    const oaId = await brandOrgId(brand, subject.oaId);
    const rows = await prisma.$queryRaw<Array<{ id: number }>>`
      INSERT INTO document_template ("TEMPLATE_ID", "TEMPLATE_BODY", "OA_ID", "USER_ID", "OA_BRAND_ID", "CREATED_BY", "CREATED_ON")
      VALUES (${v.template_id}, ${html}, ${oaId}, ${subject.userId}, ${brand}, ${subject.userId}, now())
      RETURNING "ID" AS id`;
    return { message: 'Successfully Added', id: Number(rows[0].id) };
  },

  /** CI delete($id): hard delete (now only the active brand's row). */
  async remove(subject: RequestSubject, id: number): Promise<{ message: string }> {
    await authorize(subject, TEMPLATE_MENU, 'delete');
    const n = await prisma.$executeRaw`DELETE FROM document_template WHERE "ID" = ${id} AND "OA_BRAND_ID" = ${activeBrand(subject)}`;
    if (!n) throw new NotFoundError('Document template not found.');
    return { message: 'Successfully Deleted' };
  },
};

/* ------------------------------------------------------------------ document_templates_variables */

export interface VariableRow {
  variable: string;
  /** Column chosen for it (edit: the saved FIELD_NAME). */
  column: string;
}

export interface TemplateVariablesInit {
  title: string;
  mode: 'add' | 'edit';
  values: { template_id: string; view_name: string } | null;
  templates: IdLabel[];
  views: string[];
}

async function variableRow(id: number, brand: number) {
  const rows = await prisma.$queryRaw<
    Array<{ ID: number; TEMPLATE_ID: number | null; VIEW_NAME: string | null; VARIABLE: string | null; FIELD_NAME: string | null }>
  >`SELECT "ID", "TEMPLATE_ID", "VIEW_NAME", "VARIABLE", "FIELD_NAME" FROM document_templates_variables
    WHERE "ID" = ${id} AND "OA_BRAND_ID" = ${brand} AND COALESCE("IS_DELETED", 0) = 0 LIMIT 1`;
  return rows[0] ?? null;
}

/** CI getDbView(): every view of the entity catalogue. */
async function catalogViews(): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT DISTINCT "OBJ_NM" AS name FROM entity_obj WHERE COALESCE("IS_DELETED", 0) = 0 AND "OBJ_TYP" = 'VIEW' ORDER BY 1`;
  return rows.map((r) => r.name);
}

/** CI getViewColumns($view): the view's attributes (bound, not concatenated). */
async function viewColumns(view: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT DISTINCT "OBJ_ATTRBT_NM" AS name FROM entity_obj_attrbt
    WHERE "OBJ_NM" = ${view} AND COALESCE("IS_DELETED", 0) = 0 AND "OBJ_TYP" = 'VIEW' ORDER BY 1`;
  return rows.map((r) => r.name);
}

/** CI document_templates_variables_m::getVariables($tid, $variable): DTVN masters of the template. */
async function templateVariables(templateId: number, only: string | null): Promise<string[]> {
  const typeId = await commonTypeId('DTVN');
  if (!typeId) return [];
  const rows = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT DISTINCT "MSTR_NM" AS name FROM independent_mst
    WHERE "TYP_ID" = ${typeId} AND "PARENT_MSTR_ID" = ${templateId}
      ${only === null ? Prisma.empty : Prisma.sql`AND "MSTR_NM" = ${only}`}
    ORDER BY 1`;
  return rows.map((r) => r.name);
}


const variablesSchema = z.object({
  template_id: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.coerce.number({ error: 'The Template field is required.' }).int().positive('The Template field is required.'),
  ),
  view_name: z.string({ error: 'The View field is required.' }).trim().min(1, 'The View field is required.'),
  rows: z
    .array(z.object({ variable: z.string().trim().max(200), column: z.string().trim().max(200) }))
    .max(500)
    .default([]),
});

export const templateVariablesService = {
  async formInit(subject: RequestSubject, id: number | null): Promise<TemplateVariablesInit> {
    await authorize(subject, VARIABLE_MENU, id ? 'update' : 'create');
    const brand = activeBrand(subject);
    const row = id ? await variableRow(id, brand) : null;
    if (id && !row) throw new NotFoundError('Template variable not found.');
    const [templates, views] = await Promise.all([mastersOfTypeCode('DTN'), catalogViews()]);
    return {
      title: row ? 'Edit Document Template Variables' : 'New Document Template Variables',
      mode: row ? 'edit' : 'add',
      values: row ? { template_id: row.TEMPLATE_ID ? String(row.TEMPLATE_ID) : '', view_name: row.VIEW_NAME ?? '' } : null,
      templates,
      views,
    };
  },

  /**
   * CI getVariables/{template}/{view}/{editId}: one row per template variable with a column picker of
   * the view's columns. Editing shows only the record's own variable, preselected.
   */
  async variables(subject: RequestSubject, templateId: number, view: string, editId: number | null) {
    await authorize(subject, VARIABLE_MENU, 'list');
    const brand = activeBrand(subject);
    const record = editId ? await variableRow(editId, brand) : null;
    if (editId && !record) throw new NotFoundError('Template variable not found.');
    const [names, columns] = await Promise.all([
      templateVariables(templateId, record ? record.VARIABLE ?? '' : null),
      viewColumns(view),
    ]);
    return {
      rows: names.map<VariableRow>((variable) => ({ variable, column: record?.FIELD_NAME ?? '' })),
      columns,
    };
  },

  /** CI insert() / update() → setFormControls: one row per (variable, column) pair. */
  async save(subject: RequestSubject, id: number | null, body: unknown): Promise<{ message: string; saved: number }> {
    await authorize(subject, VARIABLE_MENU, id ? 'update' : 'create');
    const brand = activeBrand(subject);
    if (id && !(await variableRow(id, brand))) throw new NotFoundError('Template variable not found.');
    const v = variablesSchema.parse(body);

    const views = await catalogViews();
    if (!views.includes(v.view_name)) throw new ValidationError('Unknown view.', { view_name: ['Select a view from the list.'] });
    const columns = new Set(await viewColumns(v.view_name));
    const pairs = v.rows.filter((r) => r.variable && r.column);
    const bad = pairs.find((r) => !columns.has(r.column));
    if (bad) throw new ValidationError(`"${bad.column}" is not a column of ${v.view_name}.`, { rows: ['Pick columns from the list.'] });
    if (!pairs.length) throw new ValidationError('Choose a column for at least one variable.', { rows: ['Choose a column for at least one variable.'] });

    const templateCd = await getMasterCode(v.template_id);
    if (id) {
      // CI applied every posted row to the same id (in edit mode only one variable is listed).
      const last = pairs[pairs.length - 1];
      await prisma.$executeRaw`
        UPDATE document_templates_variables SET "TEMPLATE_ID" = ${v.template_id}, "TEMPLATE_CD" = ${templateCd},
          "VIEW_NAME" = ${v.view_name}, "VARIABLE" = ${last.variable}, "FIELD_NAME" = ${last.column},
          "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now()
        WHERE "ID" = ${id} AND "OA_BRAND_ID" = ${brand}`;
      return { message: 'Successfully Updated Document Template Variables', saved: 1 };
    }

    await assertInsertSafe('document_templates_variables', 'ID');
    const oaId = await brandOrgId(brand, subject.oaId);
    await prisma.$transaction(
      pairs.map(
        (p) => prisma.$executeRaw`
          INSERT INTO document_templates_variables
            ("TEMPLATE_ID", "TEMPLATE_CD", "VIEW_NAME", "VARIABLE", "FIELD_NAME", "OA_ID", "USER_ID", "OA_BRAND_ID", "CREATED_BY", "CREATED_ON")
          VALUES (${v.template_id}, ${templateCd}, ${v.view_name}, ${p.variable}, ${p.column}, ${oaId}, ${subject.userId}, ${brand},
                  ${subject.userId}, now())`,
      ),
    );
    return { message: 'Successfully Added Document Template Variables', saved: pairs.length };
  },

  /** CI delete($id): hard delete (now only the active brand's row). */
  async remove(subject: RequestSubject, id: number): Promise<{ message: string }> {
    await authorize(subject, VARIABLE_MENU, 'delete');
    const n = await prisma.$executeRaw`DELETE FROM document_templates_variables WHERE "ID" = ${id} AND "OA_BRAND_ID" = ${activeBrand(subject)}`;
    if (!n) throw new NotFoundError('Template variable not found.');
    return { message: 'Successfully Deleted Document Template Variables' };
  },
};
