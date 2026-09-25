"use client";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import { useOptions } from "@/lib/lookups/useOptions";
import { checkboxGroup, flagsToIds, idsToFlags } from "../_shared/formKit";

/** CI user_group initForm: User Group name, Domain, "Select Users" (members of the domain's brand). */
const MEMBER = "member_";

interface GroupForm {
  name: string;
  domainId: string;
  [memberFlag: string]: string | boolean;
}

interface GroupDto {
  name: string;
  domainId: number;
  memberIds: number[];
}

function useGroupFields(values: GroupForm): DynamicField[] {
  const domains = useOptions("/api/user/options/domains?level=org");
  const users = useOptions(values.domainId ? `/api/user/options/users?domainId=${values.domainId}` : null);
  return [
    { name: "name", label: "User Group", type: "text", required: true },
    { name: "domainId", label: "Domain", type: "select", required: true, options: domains.options },
    ...checkboxGroup(MEMBER, "Select Users", users.options, true),
  ];
}

export default function GroupFormPage({ mode, id }: { mode: "add" | "edit"; id?: string }) {
  return (
    <ResourceFormPage<GroupForm, GroupDto>
      title={mode === "add" ? "New User Group" : "Edit User Group"}
      breadcrumb={["User", "User Group"]}
      mode={mode}
      id={id}
      apiPath="/api/user/user_group"
      basePath="/user/user_group"
      useFields={useGroupFields}
      defaultValues={{ name: "", domainId: "" }}
      toForm={(dto) => ({ name: dto.name, domainId: String(dto.domainId), ...idsToFlags(MEMBER, dto.memberIds) })}
      toPayload={(v) => ({ name: v.name, domainId: v.domainId, memberIds: flagsToIds(MEMBER, v) })}
    />
  );
}
