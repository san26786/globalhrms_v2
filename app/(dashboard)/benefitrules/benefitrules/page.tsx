import BenefitRulesList from "./BenefitRulesList";

/** CI benefitrules/benefitrules/index/{BRTYSBR | BRTYIDR | BRTYFDR | BRTYRBE} — one list per rule type. */
export default async function BenefitRulesPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  return <BenefitRulesList type={type ?? "BRTYSBR"} />;
}
