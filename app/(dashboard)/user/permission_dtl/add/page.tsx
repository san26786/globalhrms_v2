import PermissionClassForm from "../../permission_class/permissionClassForm";

/** CI user/permission_dtl/newPermissionDtl — the same form as Permission Class (CI returns to user/permission_class). */
export default function AddPermissionDtlPage() {
  return <PermissionClassForm mode="add" />;
}
