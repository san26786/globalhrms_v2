import { prisma } from '@/lib/prisma';
import { ServiceUnavailableError } from '@/lib/http/errors';

/**
 * Insert-safety guard.
 *
 * The PostgreSQL database was migrated with its primary keys dropped and most ID sequences left
 * at their start value (see the migration audit). An INSERT relying on the column default would
 * therefore silently reuse an existing ID — and with no PK constraint nothing stops it. Every
 * create path calls `assertInsertSafe` first; it refuses the insert with a clear message instead
 * of corrupting data. Once a table's sequence is ahead of MAX(pk) the result is cached for the
 * process lifetime, so the check costs nothing in normal operation.
 *
 * Fix (DBA, one-off): prisma/sql/repair_sequences.sql
 */

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const healthy = new Set<string>();

function assertIdentifier(name: string): string {
  if (!IDENTIFIER.test(name)) throw new Error(`sequenceGuard: unsafe identifier "${name}"`);
  return name;
}

interface SequenceState {
  next: bigint;
}

async function readSequence(table: string, pkColumn: string): Promise<SequenceState | null> {
  const [row] = await prisma.$queryRawUnsafe<Array<{ seq: string | null }>>(
    `SELECT pg_get_serial_sequence($1, $2) AS seq`,
    `"${assertIdentifier(table)}"`,
    assertIdentifier(pkColumn),
  );
  if (!row?.seq) return null;

  // pg_get_serial_sequence returns e.g. public."user_mst_USER_ID_seq"
  const [schema, rawName] = row.seq.split(/\.(.+)/);
  const name = rawName.replace(/^"|"$/g, '');
  const [state] = await prisma.$queryRaw<
    Array<{ last_value: bigint | null; start_value: bigint; increment_by: bigint }>
  >`SELECT last_value, start_value, increment_by FROM pg_sequences
    WHERE schemaname = ${schema.replace(/^"|"$/g, '')} AND sequencename = ${name}`;
  if (!state) return null;

  const next =
    state.last_value === null ? BigInt(state.start_value) : BigInt(state.last_value) + BigInt(state.increment_by);
  return { next };
}

async function readMax(table: string, pkColumn: string): Promise<bigint> {
  const [row] = await prisma.$queryRawUnsafe<Array<{ max: bigint | number | null }>>(
    `SELECT MAX("${assertIdentifier(pkColumn)}")::bigint AS max FROM "${assertIdentifier(table)}"`,
  );
  return row?.max === null || row?.max === undefined ? BigInt(0) : BigInt(row.max);
}

export async function assertInsertSafe(table: string, pkColumn: string): Promise<void> {
  const key = `${table}.${pkColumn}`;
  if (healthy.has(key)) return;

  const sequence = await readSequence(table, pkColumn);
  if (!sequence) {
    // No sequence → the caller must supply the id itself (e.g. common_type.TYP_ID); nothing to guard.
    healthy.add(key);
    return;
  }

  const max = await readMax(table, pkColumn);
  if (sequence.next <= max) {
    throw new ServiceUnavailableError(
      `New records cannot be saved to "${table}" yet: its ID sequence is behind existing data ` +
        `(next id ${sequence.next}, highest existing id ${max}). An administrator must run the ` +
        `database sequence repair before records can be created.`,
      'SEQUENCE_OUT_OF_SYNC',
    );
  }
  healthy.add(key);
}

/** Non-throwing variant for best-effort writes (e.g. login audit rows) that must never block the caller. */
export async function isInsertSafe(table: string, pkColumn: string): Promise<boolean> {
  try {
    await assertInsertSafe(table, pkColumn);
    return true;
  } catch (error) {
    if (error instanceof ServiceUnavailableError) return false;
    throw error;
  }
}
