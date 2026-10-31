import EmployeeForm from "../../../_shared/EmployeeForm";

/**
 * CI employeeMngt/emp_mst/editEmployeeMst/{id}/TEAM_EMP — editing from Team Employee Manager. Under the
 * Team path so the page follows the Team menu grant and returns to the Team list.
 */
export default async function EditTeamEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EmployeeForm mode="edit" screen="team" id={id} />;
}
