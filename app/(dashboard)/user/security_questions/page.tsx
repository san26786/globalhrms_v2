"use client";

import { useRouter } from "next/navigation";
import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import { useOptions } from "@/lib/lookups/useOptions";

/**
 * CI user/security_questions — four different questions (masters of type USQ) and four answers.
 * Existing answers are never sent to the browser; saving requires all four answers again.
 */
interface SecurityQuestionsForm {
  question1: string;
  question2: string;
  question3: string;
  question4: string;
  answer1: string;
  answer2: string;
  answer3: string;
  answer4: string;
}

interface SecurityQuestionsDto {
  selected: Record<"question1" | "question2" | "question3" | "question4", number | null>;
}

function useSecurityFields(): DynamicField[] {
  const { options } = useOptions("/api/lookups/masters?typeCode=USQ");
  return [1, 2, 3, 4].flatMap((n) => [
    { name: `question${n}`, label: `Question ${n}`, type: "select", required: true, options },
    { name: `answer${n}`, label: `Answer ${n}`, type: "password", required: true },
  ]);
}

const empty: SecurityQuestionsForm = {
  question1: "",
  question2: "",
  question3: "",
  question4: "",
  answer1: "",
  answer2: "",
  answer3: "",
  answer4: "",
};

export default function SecurityQuestionsPage() {
  const router = useRouter();
  return (
    <ResourceFormPage<SecurityQuestionsForm, SecurityQuestionsDto>
      title="Update Security Questions"
      breadcrumb={["User", "Security Questions"]}
      mode="edit"
      apiPath="/api/user/security_questions"
      loadUrl="/api/user/security_questions"
      submitUrl="/api/user/security_questions"
      submitMethod="PUT"
      basePath="/dashboard"
      useFields={useSecurityFields}
      defaultValues={empty}
      toForm={(dto) => ({
        ...empty,
        question1: dto.selected.question1 ? String(dto.selected.question1) : "",
        question2: dto.selected.question2 ? String(dto.selected.question2) : "",
        question3: dto.selected.question3 ? String(dto.selected.question3) : "",
        question4: dto.selected.question4 ? String(dto.selected.question4) : "",
      })}
      onSaved={() => router.push("/dashboard")}
    />
  );
}
