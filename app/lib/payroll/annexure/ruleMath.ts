/**
 * Money as CI's payroll stored it: PHP computed in doubles and sent each value to MySQL as its string form (14
 * significant digits), which a DECIMAL(…,2) column rounded half away from zero. Amounts here are integer cents;
 * `storedCents` turns a computed double into the cents CI would have stored. Shared with the payroll run (P3).
 */

/** The cents MySQL stored for the PHP double `x` (string form with precision 14, rounded half away from zero). */
export function storedCents(x: number): number {
  if (!Number.isFinite(x) || x === 0) return 0;
  const text = x.toPrecision(14);
  if (/e/i.test(text)) return Math.round(Number(text) * 100); // |x| < 1e-6 or ≥ 1e14: not a salary figure
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace('-', '').split('.');
  const digits = (fraction + '000').slice(0, 3);
  let cents = Number(whole) * 100 + Number(digits.slice(0, 2));
  if (Number(digits[2]) >= 5) cents += 1;
  return negative ? -cents : cents;
}

/** PHP's (float) cast of a rule value: the leading number ("12.5%" → 12.5), else 0. */
export function phpFloat(value: string | null | undefined): number {
  const n = Number.parseFloat(String(value ?? '').trim());
  return Number.isFinite(n) ? n : 0;
}

/** A decimal column (text or number) as cents. */
export const toCents = (value: string | number | null | undefined): number => (value === null || value === undefined || value === '' ? 0 : Math.round(Number(value) * 100));

/** Cents as the decimal text PostgreSQL stores (2 decimals). */
export const centsText = (cents: number): string => {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
};
