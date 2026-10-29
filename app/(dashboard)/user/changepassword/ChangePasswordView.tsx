"use client";

import { motion } from "motion/react";
import { Check, CircleDashed, KeyRound, LockKeyhole } from "lucide-react";

import type { ResourceFormRenderProps } from "@/components/resource/ResourceFormPage";
import {
  AccountCard,
  AccountHero,
  AccountPage,
  AccountSecretField,
  HeroBadge,
  SaveCard,
  TipsCard,
  findField,
} from "../_account/AccountUi";

/** CI user/changepassword — the brand password policy and reuse rules are enforced by the API. */
export interface ChangePasswordForm {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/** The change-password form in its own layout; ResourceFormPage still posts it. */
export default function ChangePasswordView({ form, title, breadcrumb, fields, submitting, onSubmit, onCancel }: ResourceFormRenderProps<ChangePasswordForm>) {
  const {
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = form;
  const values = watch();
  const field = (name: keyof ChangePasswordForm) => findField(fields, name);

  return (
    <AccountPage>
      <AccountHero
        current="password"
        breadcrumb={breadcrumb}
        eyebrow={title}
        heading="Keep your account secure"
        badge={<HeroBadge icon={LockKeyhole} />}
        details={<span>Choose a strong new password for signing in to Global HR.</span>}
      />

      <motion.form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="space-y-6">
          <AccountCard title="Current password" icon={KeyRound} tone="blue" intro="First, confirm the password you use today.">
            <AccountSecretField form={form} field={field("oldPassword")} icon={KeyRound} autoComplete="current-password" className="sm:max-w-md" />
          </AccountCard>

          <AccountCard title="New password" icon={LockKeyhole} intro="Type your new password twice so we know it's right.">
            <div className="grid gap-5 sm:grid-cols-2">
              <AccountSecretField form={form} field={field("newPassword")} icon={LockKeyhole} autoComplete="new-password" />
              <AccountSecretField
                form={form}
                field={field("confirmPassword")}
                icon={LockKeyhole}
                autoComplete="new-password"
                hint={<MatchHint password={values.newPassword} confirm={values.confirmPassword} />}
              />
            </div>
          </AccountCard>
        </div>

        <div className="space-y-6 lg:sticky lg:top-24">
          <TipsCard
            tips={[
              "Your company's password rules apply. If the new password doesn't meet them, you'll see what to change.",
              "Your company may not let you reuse a password you've used before.",
              "Use a password you don't use anywhere else.",
            ]}
          />
          <SaveCard dirty={isDirty} errorCount={Object.keys(errors).length} submitting={submitting} submitLabel="Update password" onCancel={onCancel} />
        </div>
      </motion.form>
    </AccountPage>
  );
}

/** Live check under "Confirm Password" (a visual aid only; the server still validates). */
function MatchHint({ password, confirm }: { password?: string; confirm?: string }) {
  if (!confirm) return null;
  const match = confirm === password;
  return (
    <span className={`flex items-center gap-1.5 font-medium ${match ? "text-emerald-800 dark:text-emerald-300" : "text-amber-900 dark:text-amber-300"}`}>
      {match ? <Check aria-hidden="true" className="h-4 w-4" /> : <CircleDashed aria-hidden="true" className="h-4 w-4" />}
      {match ? "Passwords match" : "Doesn't match the new password yet"}
    </span>
  );
}
