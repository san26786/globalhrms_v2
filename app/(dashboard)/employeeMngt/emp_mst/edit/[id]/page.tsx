import EmployeeForm from "../../_shared/EmployeeForm";

/** CI employeeMngt/emp_mst/editEmployeeMst/{id}. */
export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EmployeeForm mode="edit" screen="all" id={id} />;
}
