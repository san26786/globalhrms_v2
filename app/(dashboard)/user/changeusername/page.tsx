"use client";

import { useRouter } from "next/navigation";
import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import ChangeUsernameView, { type ChangeUsernameForm } from "./ChangeUsernameView";

/** CI user/changeusername — current username + password, new username (brand username rules). */
const fields: DynamicField[] = [
  { name: "currentUsername", label: "Current Username", type: "text", required: true },
  { name: "currentPassword", label: "Current Password", type: "password", required: true },
  { name: "newUsername", label: "New Username", type: "text", required: true },
];

export default function ChangeUsernamePage() {
  const router = useRouter();
  return (
    <ResourceFormPage<ChangeUsernameForm>
      title="Update Username"
      breadcrumb={["User", "Update Username"]}
      mode="add"
      apiPath="/api/user/changeusername"
      basePath="/dashboard"
      fields={fields}
      allowSaveAndAdd={false}
      defaultValues={{ currentUsername: "", currentPassword: "", newUsername: "" }}
      onSaved={() => {
        router.push("/dashboard");
        router.refresh();
      }}
      renderForm={(props) => <ChangeUsernameView {...props} />}
    />
  );
}
