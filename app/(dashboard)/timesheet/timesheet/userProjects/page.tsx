import UserProjectsList from "./userProjectsList";

/** CI timesheet/timesheet/userProjects/{userId} ("My Projects" / "Configure Projects") → ?userId= */
export default async function UserProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { userId } = await searchParams;
  return <UserProjectsList userId={typeof userId === "string" && /^\d+$/.test(userId) ? userId : ""} />;
}
