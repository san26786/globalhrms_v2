"use client";

import { motion } from "motion/react";
import { EyeOff, KeyRound, MessageCircleQuestion, ShieldCheck } from "lucide-react";

import type { ResourceFormRenderProps } from "@/components/resource/ResourceFormPage";
import {
  AccountCard,
  AccountHero,
  AccountPage,
  AccountSecretField,
  AccountSelectField,
  HeroBadge,
  SaveCard,
  TipsCard,
  findField,
} from "../_account/AccountUi";

/**
 * CI user/security_questions — four different questions (masters of type USQ) and four answers.
 * Existing answers are never sent to the browser; saving requires all four answers again.
 */
export interface SecurityQuestionsForm {
  question1: string;
  question2: string;
  question3: string;
  question4: string;
  answer1: string;
  answer2: string;
  answer3: string;
  answer4: string;
}

const STEPS = [1, 2, 3, 4] as const;

/** The security-questions form in its own layout; ResourceFormPage still loads and saves it. */
export default function SecurityQuestionsView({
  form,
  title,
  breadcrumb,
  fields,
  submitting,
  onSubmit,
  onCancel,
}: ResourceFormRenderProps<SecurityQuestionsForm>) {
  const {
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = form;
  const values = watch();
  const field = (name: string) => findField(fields, name);
  const ready = STEPS.filter((n) => values[`question${n}` as keyof SecurityQuestionsForm]?.trim() && values[`answer${n}` as keyof SecurityQuestionsForm]?.trim()).length;

  return (
    <AccountPage>
      <AccountHero
        current="security"
        breadcrumb={breadcrumb}
        eyebrow={title}
        heading="Set your security questions"
        badge={<HeroBadge icon={ShieldCheck} />}
        details={<span>Pick four different questions, with answers only you would know.</span>}
        aside={<Progress ready={ready} />}
      />

      <motion.form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="space-y-6">
          <motion.p
            className="flex items-start gap-3 rounded-2xl bg-[#e3edf9] px-4 py-3 text-[14px] leading-snug text-[#083f72] ring-1 ring-[#0b5394]/15 dark:bg-[#16233d] dark:text-[#cfe1fa] dark:ring-[#8cb8f0]/20"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <EyeOff aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            For your security, saved answers are never shown. Enter all four answers each time you save.
          </motion.p>

          <div className="grid gap-6 md:grid-cols-2">
            {STEPS.map((n) => (
              <AccountCard key={n} title={`Question ${n}`} icon={MessageCircleQuestion} tone={n % 2 ? "orange" : "blue"}>
                <div className="space-y-5">
                  <AccountSelectField form={form} field={field(`question${n}`)} icon={MessageCircleQuestion} />
                  <AccountSecretField form={form} field={field(`answer${n}`)} icon={KeyRound} autoComplete="off" />
                </div>
              </AccountCard>
            ))}
          </div>
        </div>

        <div className="space-y-6 lg:sticky lg:top-24">
          <TipsCard
            tips={[
              "Choose four different questions.",
              "Pick answers that won't change over time and that others can't guess.",
              "Never share your answers with anyone.",
            ]}
          />
          <SaveCard dirty={isDirty} errorCount={Object.keys(errors).length} submitting={submitting} submitLabel="Save questions" onCancel={onCancel} />
        </div>
      </motion.form>
    </AccountPage>
  );
}

/** Four dots in the hero, one per question with both a question and an answer filled in. */
function Progress({ ready }: { ready: number }) {
  return (
    <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15 backdrop-blur-sm">
      <div className="flex gap-1.5" aria-hidden="true">
        {STEPS.map((n) => (
          <motion.span
            key={n}
            className="h-2 w-8 rounded-full"
            animate={{ backgroundColor: n <= ready ? "#f8a27e" : "rgba(255,255,255,0.2)" }}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>
      <p className="mt-2 text-[14px] font-medium">
        {ready} of {STEPS.length} ready
      </p>
    </div>
  );
}
