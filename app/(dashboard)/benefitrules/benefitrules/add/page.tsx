import BenefitRuleForm from "../BenefitRuleForm";

/** CI benefitrules/benefitrules/newbenefitrules/{ruleTypeId} — ?type=<rule type code>. */
export default async function AddBenefitRulePage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  return <BenefitRuleForm mode="add" type={type ?? "BRTYSBR"} />;
}
