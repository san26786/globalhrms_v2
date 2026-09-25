/**
 * Application error hierarchy.
 *
 * Services and repositories throw these; `withApi` (./withApi.ts) turns them into the
 * standard `{ success: false, message, errors? }` envelope with the right HTTP status.
 * Anything that is NOT an AppError is treated as an internal error: it is logged and the
 * client only ever sees a generic message (no SQL, stack traces or Prisma details).
 */

export type FieldErrors = Record<string, string[]>;

export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string,
    public readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed.', fieldErrors?: FieldErrors) {
    super(400, message, 'VALIDATION_ERROR', fieldErrors);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'You are not logged in.') {
    super(401, message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(403, message, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Record not found.') {
    super(404, message, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string, fieldErrors?: FieldErrors) {
    super(409, message, 'CONFLICT', fieldErrors);
  }
}

/** A domain rule was violated (e.g. "account is locked"). */
export class BusinessRuleError extends AppError {
  constructor(message: string, code = 'BUSINESS_RULE', fieldErrors?: FieldErrors) {
    super(422, message, code, fieldErrors);
  }
}

/** The operation is temporarily impossible because of a system/data condition (not the caller's fault). */
export class ServiceUnavailableError extends AppError {
  constructor(message: string, code = 'SERVICE_UNAVAILABLE') {
    super(503, message, code);
  }
}
