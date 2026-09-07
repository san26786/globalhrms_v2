// lib/utils/object.ts
//
// Universal (client + server safe) object utilities. Generic, dependency-free
// helpers for shaping plain data objects — used across CRUD, Entity, and
// Dynamic Table code that build/filter records dynamically.

/**
 * Returns true if the value is null, undefined, an empty string, an empty
 * array, or an object with no own enumerable keys.
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

/** Returns true if the value is a plain object (not null, not an array). */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Returns a shallow copy of `obj` containing only the given keys. */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) result[key] = obj[key];
  }
  return result;
}

/** Returns a shallow copy of `obj` excluding the given keys. */
export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj } as T;
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, K>;
}

/**
 * Deep-clones a plain JSON-serializable object. Uses `structuredClone` when
 * available, falling back to a JSON round-trip. Not suitable for values
 * containing functions, class instances, or circular references.
 */
export function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}