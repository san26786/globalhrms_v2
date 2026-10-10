"use client";

import { useRouter } from "next/navigation";
import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";

/** CI user/changepassword — the brand password policy and reuse rules are enforced by the API. */
interface ChangePasswordForm {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const fields: DynamicField[] = [
  { name: "oldPassword", label: "Old Password", type: "password", required: true },
  { name: "newPassword", label: "New Password", type: "password", required: true },
  { name: "confirmPassword", label: "Confirm Password", type: "password", required: true },
];

export default function ChangePasswordPage() {
  const router = useRouter();
  return (
    <ResourceFormPage<ChangePasswordForm>
      title="Update Password"
      breadcrumb={["User", "Update Password"]}
      mode="add"
      apiPath="/api/user/changepassword"
      basePath="/dashboard"
      fields={fields}
      allowSaveAndAdd={false}
      defaultValues={{ oldPassword: "", newPassword: "", confirmPassword: "" }}
      onSaved={(data) => router.push((data as { redirectTo?: string })?.redirectTo ?? "/dashboard")}
    />
  );
}
