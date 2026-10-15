import { notFound } from "next/navigation";
import PermissionClassForm from "../../permissionClassForm";

/** CI user/permission_dtl/editPermissionDtl/{PERMISSIONS_CLASS_ID}. */
export default async function EditPermissionClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const classId = Number(id);
  if (!Number.isInteger(classId) || classId <= 0) notFound();
  return <PermissionClassForm mode="edit" classId={classId} />;
}
