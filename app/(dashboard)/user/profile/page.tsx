"use client";

import { useRouter } from "next/navigation";
import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";

/** CI user/profile — the logged-in user's own details (username is read-only). */
interface ProfileForm {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  tPin: string;
  memorableWord: string;
  localTime: boolean;
}

const fields: DynamicField[] = [
  { name: "username", label: "Username", type: "text", readOnly: true },
  { name: "firstName", label: "First Name", type: "text", required: true },
  { name: "lastName", label: "Last Name", type: "text", required: true },
  { name: "email", label: "Email Id", type: "email", required: true },
  { name: "tPin", label: "Passcode", type: "password", required: true },
  { name: "memorableWord", label: "Memorable Word", type: "text", required: true },
  { name: "localTime", label: "Local Time", type: "checkbox" },
];

export default function ProfilePage() {
  const router = useRouter();
  return (
    <ResourceFormPage<ProfileForm>
      title="Profile"
      breadcrumb={["User", "Profile"]}
      mode="edit"
      apiPath="/api/user/profile"
      loadUrl="/api/user/profile"
      submitUrl="/api/user/profile"
      submitMethod="PUT"
      basePath="/dashboard"
      fields={fields}
      defaultValues={{ username: "", firstName: "", lastName: "", email: "", tPin: "", memorableWord: "", localTime: false }}
      toPayload={(values) => { const rest = { ...values }; delete rest.username; return rest; }}
      onSaved={() => router.push("/dashboard")}
    />
  );
}
