import BenefitRuleForm from "../../BenefitRuleForm";

/** CI benefitrules/benefitrules/editbenefitrules/{id} — the record's own rule type decides the form. */
export default async function EditBenefitRulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BenefitRuleForm mode="edit" id={id} />;
}
