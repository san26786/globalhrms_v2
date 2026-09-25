import RoleList from "./roleList";

/** CI user/role_master/index/{domainId?} — ?domainId narrows to one domain (the User Domain tab). */
export default async function RoleMasterPage({ searchParams }: { searchParams: Promise<{ domainId?: string }> }) {
  const { domainId } = await searchParams;
  return <RoleList domainId={domainId && /^\d+$/.test(domainId) ? domainId : undefined} />;
}
