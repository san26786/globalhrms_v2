import { NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { AppError, type FieldErrors } from './errors';

/**
 * Standard API envelope used across GlobalHRMS:
 *   success → { success: true, data, ...extra }         (extra e.g. total, page, limit)
 *   failure → { success: false, message, code, errors? } (errors = field → messages)
 */
export function ok<T>(data: T, extra: Record<string, unknown> = {}, status = 200) {
  return NextResponse.json(serialize({ success: true, data, ...extra }), { status });
}

export function created<T>(data: T, extra: Record<string, unknown> = {}) {
  return ok(data, extra, 201);
}

export function fail(status: number, message: string, code: string, errors?: FieldErrors) {
  return NextResponse.json({ success: false, message, code, ...(errors ? { errors } : {}) }, { status });
}

export function zodFieldErrors(error: ZodError): FieldErrors {
  const flat = z.flattenError(error);
  const errors: FieldErrors = { ...(flat.fieldErrors as FieldErrors) };
  if (flat.formErrors.length) errors._form = flat.formErrors;
  return errors;
}

/** Converts any thrown value into a safe error response. Internal details are logged, never returned. */
export function toErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return fail(error.status, error.message, error.code, error.fieldErrors);
  }
  if (error instanceof ZodError) {
    return fail(400, 'Validation failed.', 'VALIDATION_ERROR', zodFieldErrors(error));
  }
  console.error('[api] unhandled error', error);
  return fail(500, 'Something went wrong. Please try again.', 'INTERNAL_ERROR');
}

/** Raw SQL can return BigInt (e.g. COUNT(*)); JSON.stringify cannot serialise it. */
function serialize<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? Number(v) : v)),
  ) as T;
}
