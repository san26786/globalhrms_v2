"use client";

import ResourceFormPage from "@/components/resource/ResourceFormPage";

/** CI authoritylevel initForm — fields, values and permissions come from lib/user/authorityLevel.form.ts. */
export default function AuthorityLevelFormPage({ mode, id }: { mode: "add" | "edit"; id?: string }) {
  return (
    <ResourceFormPage
      breadcrumb={["User", "Authority Level"]}
      mode={mode}
      id={id}
      apiPath="/api/user/authoritylevel"
      basePath="/user/authoritylevel"
      initUrl="/api/user/authoritylevel/init"
    />
  );
}
