import FormPage from "../userRoleForm";

export default async function AddUserRolePage({ searchParams }: { searchParams: Promise<{ userId?: string }> }) {
  const { userId } = await searchParams;
  return <FormPage mode="add" userId={userId && /^\d+$/.test(userId) ? userId : undefined} />;
}
