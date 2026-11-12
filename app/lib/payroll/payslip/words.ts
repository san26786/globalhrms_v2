/**
 * CI emp_sal_component_mst_m::getAmountInWords — a payslip's net pay in words, in CI's style (Title Case,
 * "Rupees", "And … Paise", international scale words Thousand / Million / …, no "and" after "Hundred").
 *
 * Behaviour changes: every group is spelled fully (CI dropped a group with leading zeros — 9,032.26 printed "Nine
 * Thousand Three Rupees …" on 722 payslips), teens after a hundred read "Two Hundred Twelve" (CI: "Ten Two"), zero is
 * "Zero Rupees" and a negative amount starts "Minus" (CI printed nothing before "Rupees").
 */
const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen',
  'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', 'ten', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion'];

function belowThousand(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} hundred`);
    n %= 100;
  }
  if (n >= 20) parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : ''));
  else if (n > 0) parts.push(ONES[n]);
  return parts.join(' ');
}

const titleCase = (s: string) => s.replace(/(^|\s)([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase());

export function amountInWords(amount: number | string): string {
  const value = Number(amount);
  const cents = Math.round(Math.abs(value) * 100);
  let rupees = Math.floor(cents / 100);
  const paise = cents % 100;
  const groups: string[] = [];
  if (rupees === 0) groups.push('zero');
  for (let k = 0; rupees > 0; k++, rupees = Math.floor(rupees / 1000)) {
    const g = rupees % 1000;
    if (g) groups.unshift(belowThousand(g) + (SCALES[k] ? ` ${SCALES[k]}` : ''));
  }
  let words = `${value < 0 && cents ? 'minus ' : ''}${groups.join(' ')} Rupees`;
  if (paise) words += ` and ${belowThousand(paise)} Paise`;
  return titleCase(words);
}
