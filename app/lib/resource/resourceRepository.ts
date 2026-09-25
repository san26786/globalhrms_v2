import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';

/**
 * Minimal, model-agnostic persistence port used by ResourceService.
 * Only models named in a code-reviewed ResourceDefinition ever reach this (no user-supplied model
 * names), so the dynamic delegate lookup is safe. Updates and deletes are `*Many` with the full
 * scope in `where`, which enforces tenant scoping on writes and keeps working on migrated tables
 * that currently have no primary-key constraint.
 */
type Args = Record<string, unknown>;

interface ModelDelegate {
  findMany(args: Args): Promise<Record<string, unknown>[]>;
  findFirst(args: Args): Promise<Record<string, unknown> | null>;
  count(args: Args): Promise<number>;
  create(args: Args): Promise<Record<string, unknown>>;
  updateMany(args: Args): Promise<{ count: number }>;
  deleteMany(args: Args): Promise<{ count: number }>;
}

function delegate(model: Prisma.ModelName): ModelDelegate {
  const d = (prisma as unknown as Record<string, ModelDelegate | undefined>)[model];
  if (!d) throw new Error(`resourceRepository: unknown Prisma model "${model}"`);
  return d;
}

export const resourceRepository = {
  findMany(model: Prisma.ModelName, args: Args) {
    return delegate(model).findMany(args);
  },
  findFirst(model: Prisma.ModelName, args: Args) {
    return delegate(model).findFirst(args);
  },
  count(model: Prisma.ModelName, args: Args) {
    return delegate(model).count(args);
  },
  create(model: Prisma.ModelName, args: Args) {
    return delegate(model).create(args);
  },
  updateMany(model: Prisma.ModelName, args: Args) {
    return delegate(model).updateMany(args);
  },
  deleteMany(model: Prisma.ModelName, args: Args) {
    return delegate(model).deleteMany(args);
  },
};
