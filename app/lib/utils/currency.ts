// lib/utils/currency.ts
//
// Universal (client + server safe) currency utilities.
//
// `convertNumberToWords` and `getIndianCurrency` already exist in
// `@/lib/commonHelpers` (migrated from the CodeIgniter `common_helper.php`).
// They are re-exported here so all currency-related utilities live under one
// import path, without duplicating their logic.

import { convertNumberToWords, getIndianCurrency } from "@/lib/commonHelpers";
import { DEFAULT_CURRENCY, DEFAULT_LOCALE } from "@/lib/utils/constants";

export { convertNumberToWords, getIndianCurrency };

/** Alias of `convertNumberToWords` with a more conventional name for new code. */
export const numberToWords = convertNumberToWords;

/** Alias of `getIndianCurrency` with a name that reflects what it returns. */
export const toIndianCurrencyWords = getIndianCurrency;

/**
 * Formats a number as currency using the native Intl API.
 * Prefer this for on-screen currency display; use `toIndianCurrencyWords`
 * only when a written-out amount is required (e.g. cheques, legal documents).
 *
 * @example formatCurrency(125000) // "₹1,25,000.00" (default en-IN/INR)
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency: string = DEFAULT_CURRENCY,
  locale: string | string[] = DEFAULT_LOCALE
): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "";
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
}