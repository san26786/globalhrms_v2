import UserFormPage from "../../userForm";
import UserActions from "../../userActions";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <UserActions id={id} />
      <UserFormPage mode="edit" id={id} />
    </>
  );
}
