import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { ValidationError } from '@/lib/http/errors';
import type { AccessPolicy } from '@/lib/resource';

/**
 * Building blocks shared by the entity resources (CI controllers/entity/*).
 */

/** Entity definitions (objects, attributes, mappings, privileges): admins read, only the system admin writes. */
export const entityDefinitionPolicy: AccessPolicy = {
  async check(subject, action) {
    if (action === 'list' || action === 'read') return subject.adminLevel >= 1;
    return subject.adminLevel === 2;
  },
};

/** Edit-only definitions (CI entity_obj_attrbt_dependent_data has no insert/delete). */
export const entityEditOnlyPolicy: AccessPolicy = {
  async check(subject, action) {
    if (action === 'list' || action === 'read') return subject.adminLevel >= 1;
    return action === 'update' && subject.adminLevel === 2;
  },
};

export const ACTIVE = 0;
export const DELETED = 1;

/** Parent common_type of the "layer" types used by object mappings (CI obj_mppng). */
export const LAYER_PARENT_TYPE_ID = 27;

/**
 * Default column label (CI list/form headers when no display row exists): the column name
 * humanised, with a trailing "_ID" / " Id" removed — e.g. OA_BRAND_ID → "Oa Brand".
 */
export function humanizeColumn(name: string): string {
  const base = name.trim().replace(/_ID$/i, '');
  const words = base
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  const label = words.join(' ').replace(/ Id$/, '');
  return label || name.trim();
}

/**
 * Which of `names` exist as tables/views in the current PostgreSQL schema — ONE query for a whole
 * page of rows (1,194 registered CI views were never recreated in PostgreSQL).
 */
export async function existingDbObjects(names: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(names.filter(Boolean))];
  if (!unique.length) return new Map();
  const rows = await prisma.$queryRaw<Array<{ table_name: string; table_type: string }>>(
    Prisma.sql`SELECT table_name, table_type FROM information_schema.tables
               WHERE table_schema = current_schema() AND table_name = ANY(${unique}::text[])`,
  );
  return new Map(rows.map((r) => [r.table_name, r.table_type]));
}

export interface ActiveObject {
  OBJ_ID: number;
  OBJ_NM: string;
  OBJ_TYP: string;
}

export async function findActiveObject(objId: number): Promise<ActiveObject | null> {
  return prisma.entity_obj.findFirst({
    where: { OBJ_ID: objId, IS_DELETED: ACTIVE },
    select: { OBJ_ID: true, OBJ_NM: true, OBJ_TYP: true },
    orderBy: { OBJ_ID: 'asc' },
  });
}

export interface ActiveAttribute {
  OBJ_ATTRBT_ID: number;
  OBJ_NM: string;
  OBJ_ATTRBT_NM: string;
}

export async function findActiveAttribute(attributeId: number): Promise<ActiveAttribute | null> {
  return prisma.entity_obj_attrbt.findFirst({
    where: { OBJ_ATTRBT_ID: attributeId, IS_DELETED: ACTIVE },
    select: { OBJ_ATTRBT_ID: true, OBJ_NM: true, OBJ_ATTRBT_NM: true },
    orderBy: { OBJ_ATTRBT_ID: 'asc' },
  });
}

/** The attribute must exist and belong to `objNm` (CI never checked this). */
export async function requireAttributeOf(attributeId: number, objNm: string, field: string): Promise<ActiveAttribute> {
  const attribute = await findActiveAttribute(attributeId);
  if (!attribute || attribute.OBJ_NM !== objNm) {
    throw new ValidationError('Validation failed.', { [field]: ['Select an attribute of the chosen object.'] });
  }
  return attribute;
}

/** Brand + its organisation (sysadmin brand choice). */
export async function requireBrand(oaBrandId: number, field = 'oaBrandId') {
  const brand = await prisma.oa_brands.findFirst({
    where: { OA_BRAND_ID: oaBrandId, IS_DELETED: 0 },
    select: { OA_BRAND_ID: true, OA_ID: true, OA_BRAND_NM: true },
  });
  if (!brand) throw new ValidationError('Validation failed.', { [field]: ['Brand not found.'] });
  return brand;
}

/** Batch id → name maps for list enrichment (no N+1). */
export async function objectNames(ids: Array<number | null | undefined>): Promise<Map<number, string>> {
  const unique = [...new Set(ids.filter((i): i is number => typeof i === 'number' && Number.isInteger(i)))];
  if (!unique.length) return new Map();
  const rows = await prisma.entity_obj.findMany({ where: { OBJ_ID: { in: unique } }, select: { OBJ_ID: true, OBJ_NM: true } });
  return new Map(rows.map((r) => [r.OBJ_ID, r.OBJ_NM]));
}

export async function attributeNames(ids: Array<number | null | undefined>): Promise<Map<number, string>> {
  const unique = [...new Set(ids.filter((i): i is number => typeof i === 'number' && Number.isInteger(i)))];
  if (!unique.length) return new Map();
  const rows = await prisma.entity_obj_attrbt.findMany({
    where: { OBJ_ATTRBT_ID: { in: unique } },
    select: { OBJ_ATTRBT_ID: true, OBJ_ATTRBT_NM: true },
  });
  return new Map(rows.map((r) => [r.OBJ_ATTRBT_ID, r.OBJ_ATTRBT_NM]));
}

export async function brandNames(ids: Array<number | null | undefined>): Promise<Map<number, string>> {
  const unique = [...new Set(ids.filter((i): i is number => typeof i === 'number'))];
  if (!unique.length) return new Map();
  const rows = await prisma.oa_brands.findMany({
    where: { OA_BRAND_ID: { in: unique } },
    select: { OA_BRAND_ID: true, OA_BRAND_NM: true },
  });
  return new Map(rows.map((r) => [r.OA_BRAND_ID, r.OA_BRAND_NM]));
}

/** Parses an id stored in a varchar column (CI entity_obj_attrbt_mppng *_NM columns). */
export function storedId(value: unknown): number | null {
  const n = Number(typeof value === 'string' ? value.trim() : value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** List-filter parser for id query params. */
export function idFilter(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new ValidationError('Invalid filter.', { filter: ['Must be a positive integer.'] });
  return id;
}
