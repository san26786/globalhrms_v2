import GroupRoleList from "./groupRoleList";

/** CI user/user_group_role/index/{groupId?} — ?groupId narrows to one group. */
export default async function UserGroupRolePage({ searchParams }: { searchParams: Promise<{ groupId?: string }> }) {
  const { groupId } = await searchParams;
  return <GroupRoleList groupId={groupId && /^\d+$/.test(groupId) ? groupId : undefined} />;
}
