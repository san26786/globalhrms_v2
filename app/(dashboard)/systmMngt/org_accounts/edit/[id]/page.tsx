import OrgAccountForm from "../../OrgAccountForm";

/** CI systmMngt/org_accounts/editOrgAccounts/{id} (the header's organisation link for admins). */
export default async function EditOrgAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrgAccountForm id={id} />;
}
