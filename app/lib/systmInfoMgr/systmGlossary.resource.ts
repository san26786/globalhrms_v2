import { prisma } from '@/lib/prisma';
import { ConflictError } from '@/lib/http/errors';
import { ResourceService, menuPolicy, type ResourceDefinition } from '@/lib/resource';
import { glossarySchema, type GlossaryInput } from '@/validations/systmInfoMgr.schema';

/**
 * System Glossary — CI controllers/systmInfoMgr/systm_glssry.php.
 * Global table (no org/brand columns). Code is unique (CI addEditUnique). CI hard-deleted rows;
 * the table has IS_DELETED, so deletes are soft here (recoverable, same visible result).
 */
export interface GlossaryDto {
  id: number;
  code: string;
  meaning: string;
  description: string | null;
}

async function assertCodeUnique(code: string, exceptId?: number) {
  const clash = await prisma.systm_glssry.findFirst({
    where: { GLSSRY_CD: { equals: code, mode: 'insensitive' }, IS_DELETED: 0, ...(exceptId ? { NOT: { GLSSRY_ID: exceptId } } : {}) },
    select: { GLSSRY_ID: true },
  });
  if (clash) throw new ConflictError('Glossary code should contain unique value.', { code: ['Glossary code should contain unique value.'] });
}

const definition: ResourceDefinition<GlossaryInput, GlossaryInput, GlossaryDto> = {
  label: 'Glossary entry',
  model: 'systm_glssry',
  primaryKey: 'GLSSRY_ID',
  searchFields: ['GLSSRY_CD', 'GLSSRY_MNNG', 'GLSSRY_DSCRPTN'],
  sortFields: ['GLSSRY_ID', 'GLSSRY_CD', 'GLSSRY_MNNG'],
  defaultSort: { field: 'GLSSRY_ID', dir: 'desc' },
  tenancy: { mode: 'none' },
  softDelete: { column: 'IS_DELETED', deleted: 1, active: 0 },
  policy: menuPolicy('systmInfoMgr/systm_glssry'),
  createSchema: glossarySchema,
  updateSchema: glossarySchema,
  toCreateData: (i) => ({ GLSSRY_CD: i.code, GLSSRY_MNNG: i.meaning, GLSSRY_DSCRPTN: i.description }),
  toUpdateData: (i) => ({ GLSSRY_CD: i.code, GLSSRY_MNNG: i.meaning, GLSSRY_DSCRPTN: i.description }),
  toDto: (r) => ({
    id: r.GLSSRY_ID as number,
    code: r.GLSSRY_CD as string,
    meaning: r.GLSSRY_MNNG as string,
    description: (r.GLSSRY_DSCRPTN as string | null) ?? null,
  }),
  hooks: {
    beforeCreate: (i) => assertCodeUnique(i.code),
    beforeUpdate: (id, i) => assertCodeUnique(i.code, id),
  },
};

export const systmGlossaryService = new ResourceService(definition);
