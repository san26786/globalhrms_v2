"use client";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import { useOptions } from "@/lib/lookups/useOptions";
import { checkboxGroup, flagsToIds, idOrEmpty, idsToFlags, useUserAdminMeta, withoutFlags } from "../_shared/formKit";

/**
 * CI user_master initForm: UserName, RegEmail, Password (required on add, "[unchanged]" on edit),
 * ExtRefID, Domain, IsAdmin (admins only), tPin, memorableWord, activation (while pending),
 * Status (read-only), Primary Role (multiple), User Type (UCT masters).
 * Roles are those of the chosen domain's brand (dependent on Domain).
 */
const ROLE = "role_";

interface UserForm {
  userName: string;
  regEmail: string;
  password: string;
  extRefId: string;
  domainId: string;
  isAdmin: boolean;
  tPin: string;
  memorableWord: string;
  userTypeId: string;
  activate: boolean;
  statusName: string;
  activated: boolean;
  [roleFlag: string]: string | boolean;
}

export interface UserDto {
  id: number;
  userName: string;
  regEmail: string;
  extRefId: string | null;
  domainId: number | null;
  isAdmin: boolean;
  userTypeId: number | null;
  statusName: string | null;
  activated: boolean;
  roleIds: number[];
}

function useUserFields(values: UserForm, mode: "add" | "edit"): DynamicField[] {
  const meta = useUserAdminMeta();
  const domains = useOptions("/api/user/options/domains?level=org");
  const roles = useOptions(values.domainId ? `/api/user/options/roles?domainId=${values.domainId}` : null);
  const userTypes = useOptions("/api/lookups/masters?typeCode=UCT");

  return [
    { name: "userName", label: "User Name", type: "text", required: true, colSpan: 6 } as DynamicField,
    { name: "regEmail", label: "Reg Email", type: "email", required: true, colSpan: 6 } as DynamicField,
    {
      name: "password",
      label: "Password",
      type: "password",
      required: mode === "add",
      placeholder: mode === "edit" ? "[unchanged]" : undefined,
      colSpan: 6,
    } as DynamicField,
    { name: "extRefId", label: "Ext Ref ID", type: "text", colSpan: 6 } as DynamicField,
    { name: "domainId", label: "User Domain", type: "select", required: true, options: domains.options, colSpan: 6 } as DynamicField,
    { name: "userTypeId", label: "User Type", type: "select", options: userTypes.options, colSpan: 6 } as DynamicField,
    {
      name: "tPin",
      label: "TPin",
      type: "password",
      required: mode === "add",
      placeholder: mode === "edit" ? "[unchanged]" : "6 digits",
      colSpan: 6,
    } as DynamicField,
    {
      name: "memorableWord",
      label: "Memorable Word",
      type: "password",
      required: mode === "add",
      placeholder: mode === "edit" ? "[unchanged]" : undefined,
      colSpan: 6,
    } as DynamicField,
    ...(meta?.canSetAdmin ? [{ name: "isAdmin", label: "Is Admin", type: "checkbox", colSpan: 4 } as DynamicField] : []),
    ...(mode === "edit" && !values.activated
      ? [{ name: "activate", label: "Activate account (clear pending activation)", type: "checkbox", colSpan: 8 } as DynamicField]
      : []),
    ...(mode === "edit"
      ? [{ name: "statusName", label: "Status", type: "text", readOnly: true, disabled: true, colSpan: 6 } as DynamicField]
      : []),
    ...checkboxGroup(ROLE, "Primary Role", roles.options, true),
  ];
}

const useAddUserFields = (v: UserForm) => useUserFields(v, "add");
const useEditUserFields = (v: UserForm) => useUserFields(v, "edit");

export default function UserFormPage({ mode, id }: { mode: "add" | "edit"; id?: string }) {
  return (
    <ResourceFormPage<UserForm, UserDto>
      title={mode === "add" ? "Add New User" : "Edit User Details"}
      breadcrumb={["User", "User Master"]}
      mode={mode}
      id={id}
      apiPath="/api/user/user_master"
      basePath="/user/user_master"
      useFields={mode === "add" ? useAddUserFields : useEditUserFields}
      defaultValues={{
        userName: "",
        regEmail: "",
        password: "",
        extRefId: "",
        domainId: "",
        isAdmin: false,
        tPin: "",
        memorableWord: "",
        userTypeId: "",
        activate: false,
        statusName: "",
        activated: true,
      }}
      toForm={(dto) => ({
        userName: dto.userName,
        regEmail: dto.regEmail,
        password: "",
        extRefId: dto.extRefId ?? "",
        domainId: idOrEmpty(dto.domainId),
        isAdmin: dto.isAdmin,
        tPin: "",
        memorableWord: "",
        userTypeId: idOrEmpty(dto.userTypeId),
        activate: false,
        statusName: dto.statusName ?? "",
        activated: dto.activated,
        ...idsToFlags(ROLE, dto.roleIds),
      })}
      toPayload={(v) => {
        const rest = withoutFlags(ROLE, v);
        return {
          userName: rest.userName,
          regEmail: rest.regEmail,
          password: rest.password,
          extRefId: rest.extRefId,
          domainId: rest.domainId,
          isAdmin: rest.isAdmin ?? false,
          tPin: rest.tPin,
          memorableWord: rest.memorableWord,
          userTypeId: rest.userTypeId,
          ...(mode === "edit" ? { activate: rest.activate ?? false } : {}),
          roleIds: flagsToIds(ROLE, v),
        };
      }}
    />
  );
}
