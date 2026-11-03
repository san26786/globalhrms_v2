"use client";

import ResourceFormPage from "@/components/resource/ResourceFormPage";

/** CI user_domain initForm — fields, values and permissions come from lib/user/userDomain.form.ts. */
export default function DomainFormPage({ mode, id }: { mode: "add" | "edit"; id?: string }) {
  return (
    <ResourceFormPage
      breadcrumb={["User", "User Domain"]}
      mode={mode}
      id={id}
      apiPath="/api/user/user_domain"
      basePath="/user/user_domain"
      initUrl="/api/user/user_domain/init"
    />
  );
}
