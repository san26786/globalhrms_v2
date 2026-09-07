// lib/utils/constants.ts
//
// Shared constants used across the utility framework, so patterns/defaults
// live in one place instead of being redefined per-file.

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Loose international phone check: optional "+", digits, spaces, "-()." */
export const PHONE_REGEX = /^\+?[\d\s\-().]+$/;

export const DEFAULT_LOCALE = "en-IN";
export const DEFAULT_CURRENCY = "INR";

/** Common MIME types used by export/import utilities. */
export const MIME_TYPES = {
  csv: "text/csv;charset=utf-8;",
  json: "application/json;charset=utf-8;",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
  plain: "text/plain;charset=utf-8;",
} as const;

/** Two-level TLDs used by `extractDomain` in string.ts. */
export const TWO_LEVEL_TLDS = new Set([
  "co.uk", "org.uk", "gov.uk", "ac.uk",
  "co.in", "co.jp", "co.nz", "co.za",
  "com.au", "com.br", "com.cn",
]);