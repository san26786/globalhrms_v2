import type { Tx } from '@/lib/employeeMngt/hub/hubEngine';
import { getMasterId } from '@/lib/masters/masterService';
import { prisma } from '@/lib/prisma';
import { numericUpper } from '../tds/compute';

/**
 * CI emp_investment_declarations_m::getInvestmentDeclarationRule / getMaximumLimitAllSections: the Investment
 * Declaration Rules (pay_component_benefit_rules, rule type BRTYIDR, Benefit Rules screen) that cap what each section
 * of a declaration is worth. A section's benefit is the declared amount capped by the matching rule's UPPER_LIMIT
 * (an open-limit rule does not cap); Section 80U's benefit is the rule's limit itself.
 *
 * Matching is CI's: the rule's section, financial year, brand and country, IN_SAME_COUNCIL (default 0) and, when
 * given (PHP !empty — '' and '0' are not), completion status, severity, payment mode, disability type, expense
 * type and age; SELF_OCCUPIED when not null. Of several matching rules the last one wins (CI's foreach overwrote).
 *
 * Behaviour changes: the declaration's brand and that brand's country (CI: the session's — the same for every live
 * declaration); no matching rule gives no benefit (CI left the previous benefit on an update); Medical Expenses
 * match the row's dependent type too (CI passed an undefined variable, so only the age counted — same limits in
 * the live rules); 80DD's severity and 80U's disability type match the rule's SEVERE_TYPE or DISABILITY_TYPE (CI's
 * Benefit Rules stored them in each other's column, so CI never found a rule and gave both sections no benefit).
 */
export interface RuleScope {
  brand: number;
  /** The brand's country (oa_brands.country); null matches any. */
  country: number | null;
  fy: number;
}

export interface RuleQualifiers {
  /** Filtered when not null/undefined (CI: `!== null`). */
  selfOccupied?: number | null;
  completionStatus?: string | number | null;
  inSameCouncil?: number;
  payment?: string | number | null;
  disability?: string | number | null;
  expenses?: string | number | null;
  age?: string | number | null;
  severe?: string | number | null;
}

export interface DeclarationRule {
  id: number;
  /** UPPER_LIMIT as stored ('&infin;' on open rows). */
  upper: string;
  open: boolean;
}

/** PHP !empty() of a posted value. */
export const given = (v: unknown): v is string | number => v !== null && v !== undefined && String(v).trim() !== '' && String(v).trim() !== '0';

/** The brand's country (CI: the session's countryId). */
export async function brandCountry(brand: number, db: Tx = prisma): Promise<number | null> {
  const [b] = await db.$queryRaw<Array<{ country: number | null }>>`SELECT country FROM oa_brands WHERE "OA_BRAND_ID" = ${brand}`;
  return b?.country === null || b?.country === undefined ? null : Number(b.country);
}

/** CI getInvestmentDeclarationRule: the rule that applies (the last matching one), or null. */
export async function matchingRule(db: Tx, scope: RuleScope, sectionCode: string, q: RuleQualifiers = {}): Promise<DeclarationRule | null> {
  const section = await getMasterId(sectionCode);
  if (!section) return null;
  const params: unknown[] = [section, scope.fy, scope.brand, scope.country, Number(q.inSameCouncil ?? 0) ? 1 : 0];
  const where = [
    'r."SECTION_ID" = $1::int', 'r."FINANCIAL_YEAR_ID" = $2::int', 'r."IS_DELETED" = 0', 'r."OA_BRAND_ID" = $3::int',
    '($4::int IS NULL OR r."COUNTRY" = $4::int)', 'r."IN_SAME_COUNCIL" = $5::int',
  ];
  const text = (column: string, v: unknown) => {
    if (!given(v)) return;
    params.push(String(v).trim());
    where.push(`btrim(r."${column}") = $${params.length}::text`);
  };
  if (given(q.completionStatus)) {
    params.push(Number(q.completionStatus));
    where.push(`r."COMPLETION_STATUS_ID" = $${params.length}::int`);
  }
  // CI's Benefit Rules insert swapped the two columns (benefitrules_m::insert's argument order): the live 80DD rules
  // hold the dependent's severity in DISABILITY_TYPE and the 80U rules the disability type in SEVERE_TYPE, so CI never
  // matched them. The two master types' ids are distinct: either column matches.
  for (const v of [q.severe, q.disability]) {
    if (!given(v)) continue;
    params.push(String(v).trim());
    where.push(`(btrim(r."SEVERE_TYPE") = $${params.length}::text OR btrim(r."DISABILITY_TYPE") = $${params.length}::text)`);
  }
  text('PAYMENT', q.payment);
  text('EXPENSES_TYPE', q.expenses);
  text('AGE', q.age);
  if (q.selfOccupied !== null && q.selfOccupied !== undefined) {
    params.push(Number(q.selfOccupied) ? 1 : 0);
    where.push(`r."SELF_OCCUPIED" = $${params.length}::int`);
  }
  const rows = await db.$queryRawUnsafe<Array<{ id: number; upper: string | null; open: number }>>(
    `SELECT r."BENEFIT_RULES_ID" AS id, r."UPPER_LIMIT" AS upper, r."OPEN_LIMIT" AS open
     FROM pay_component_benefit_rules r WHERE ${where.join(' AND ')} ORDER BY r."BENEFIT_RULES_ID" DESC LIMIT 1`,
    ...params,
  );
  const r = rows[0];
  return r ? { id: Number(r.id), upper: String(r.upper ?? ''), open: Number(r.open) === 1 } : null;
}

/**
 * CI's cap: an open rule passes the amount; else the limit, or the amount when below it (a limit that is not a
 * number — '&infin;' on a closed row — stored 0). No rule: no benefit.
 */
export function cappedBenefit(rule: DeclarationRule | null, amount: number): number {
  if (!rule) return 0;
  if (rule.open) return amount;
  const limit = numericUpper(rule.upper) ?? 0;
  return limit > amount ? amount : limit;
}

/** Section 80U: the rule's limit is the benefit. */
export function limitBenefit(rule: DeclarationRule | null): number {
  return rule ? (numericUpper(rule.upper) ?? 0) : 0;
}

/** A rule's limit for display ('∞' for an open / infinite one). */
export function limitLabel(rule: Pick<DeclarationRule, 'upper' | 'open'> | null): string | null {
  if (!rule) return null;
  const n = numericUpper(rule.upper);
  return n === null ? '∞' : String(n);
}

/**
 * CI getMaximumLimitAllSections: per section code, the first Investment Declaration Rule of the year (the "Max
 * Benefit" shown on each section's card).
 */
export async function maximumLimits(scope: RuleScope, db: Tx = prisma): Promise<Record<string, string>> {
  const rows = await db.$queryRaw<Array<{ code: string; upper: string | null; open: number }>>`
    SELECT DISTINCT ON (im."MSTR_CD") im."MSTR_CD" AS code, r."UPPER_LIMIT" AS upper, r."OPEN_LIMIT" AS open
    FROM pay_component_benefit_rules r JOIN independent_mst im ON im."MSTR_ID" = r."SECTION_ID"
    WHERE r."FINANCIAL_YEAR_ID" = ${scope.fy} AND r."IS_DELETED" = 0 AND r."OA_BRAND_ID" = ${scope.brand}
      AND (${scope.country}::int IS NULL OR r."COUNTRY" = ${scope.country}::int)
      AND r."RULE_TYPE_ID" = (SELECT "MSTR_ID" FROM independent_mst WHERE "MSTR_CD" = 'BRTYIDR' ORDER BY "MSTR_ID" LIMIT 1)
    ORDER BY im."MSTR_CD", r."BENEFIT_RULES_ID"`;
  const out: Record<string, string> = {};
  for (const r of rows) out[r.code] = limitLabel({ upper: String(r.upper ?? ''), open: Number(r.open) === 1 }) ?? '';
  return out;
}
