"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import DynamicForm from "@/components/DynamicForm/DynamicForm";
import { commonTypeFields } from "../commonTypeFields";

interface CommonTypeForm {
  type_id: string;
  type_code: string;
  type_name: string;
  view_name: string;
  dataType: string;
  visibleToUser: boolean;
  userCanCreateData: boolean;
  isEditable: boolean;
  chkParentID: boolean;
  parent_id: string;
}

export default function AddCommonTypePage() {
  const router = useRouter();

  const form = useForm<CommonTypeForm>({
    defaultValues: {
      type_id: "",
      type_code: "",
      type_name: "",
      view_name: "",
      dataType: "",
      visibleToUser: false,
      userCanCreateData: false,
      isEditable: false,
      chkParentID: false,
      parent_id: "",
    },
  });

  // Dummy dropdowns (replace with API later)
  const dataTypes = [
    { label: "Master", value: "MASTER" },
    { label: "Transaction", value: "TRANSACTION" },
  ];

  const parentTypes = [
    { label: "Country", value: 1 },
    { label: "Department", value: 2 },
  ];

  const fields = commonTypeFields(dataTypes, parentTypes);

  const onSubmit = async (data: CommonTypeForm) => {
    console.log(data);

    // Later
    // await CommonTypeService.create(data);

    router.push("/common/common_type");
  };

  return (
    <DynamicForm
      form={form}
      title="Add System Entity"
      mode="add"
      fields={fields}
      onSubmit={onSubmit}
      onCancel={() => router.push("/common/common_type")}
    />
  );
}