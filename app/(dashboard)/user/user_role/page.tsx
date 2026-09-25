import UserRoleList from "./userRoleList";

/** CI user/user_role/index/{userId} — the "User Role" tab of a user (?userId). */
export default async function UserRolePage({ searchParams }: { searchParams: Promise<{ userId?: string }> }) {
  const { userId } = await searchParams;
  return <UserRoleList userId={userId && /^\d+$/.test(userId) ? userId : undefined} />;
}
