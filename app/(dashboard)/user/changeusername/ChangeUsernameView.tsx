"use client";

import { motion } from "motion/react";
import { ArrowDown, AtSign, KeyRound, Lock, UserRoundPen } from "lucide-react";

import type { ResourceFormRenderProps } from "@/components/resource/ResourceFormPage";
import {
  AccountCard,
  AccountHero,
  AccountPage,
  AccountSecretField,
  AccountTextField,
  HeroBadge,
  SaveCard,
  TipsCard,
  findField,
} from "../_account/AccountUi";

/** CI user/changeusername — current username + password, new username (brand username rules). */
export interface ChangeUsernameForm {
  currentUsername: string;
  currentPassword: string;
  newUsername: string;
}

/** The change-username form in its own layout; ResourceFormPage still posts it. */
export default function ChangeUsernameView({ form, title, breadcrumb, fields, submitting, onSubmit, onCancel }: ResourceFormRenderProps<ChangeUsernameForm>) {
  const {
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = form;
  const values = watch();
  const field = (name: keyof ChangeUsernameForm) => findField(fields, name);

  return (
    <AccountPage>
      <AccountHero
        current="username"
        breadcrumb={breadcrumb}
        eyebrow={title}
        heading="Pick a new username"
        badge={<HeroBadge icon={UserRoundPen} />}
        details={<span>Your username is what you type when you sign in.</span>}
        aside={<UsernamePreview from={values.currentUsername} to={values.newUsername} />}
      />

      <motion.form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="space-y-6">
          <AccountCard title="Confirm it's you" icon={Lock} tone="blue" intro="Enter the username and password you sign in with today.">
            <div className="grid gap-5 sm:grid-cols-2">
              <AccountTextField form={form} field={field("currentUsername")} icon={AtSign} autoComplete="username" />
              <AccountSecretField form={form} field={field("currentPassword")} icon={KeyRound} autoComplete="current-password" />
            </div>
          </AccountCard>

          <AccountCard title="Your new username" icon={AtSign} intro="Choose the username you'd like to sign in with from now on.">
            <AccountTextField form={form} field={field("newUsername")} icon={AtSign} autoComplete="off" />
          </AccountCard>
        </div>

        <div className="space-y-6 lg:sticky lg:top-24">
          <TipsCard
            tips={[
              "Your current password is needed to confirm it's you.",
              "The new username has to follow your company's username rules.",
              "Your password stays the same.",
            ]}
          />
          <SaveCard dirty={isDirty} errorCount={Object.keys(errors).length} submitting={submitting} submitLabel="Update username" onCancel={onCancel} />
        </div>
      </motion.form>
    </AccountPage>
  );
}

/** Live "from → to" preview in the hero. */
function UsernamePreview({ from, to }: { from?: string; to?: string }) {
  return (
    <div className="w-full max-w-[16rem] space-y-1.5 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15 backdrop-blur-sm sm:w-auto sm:min-w-[13rem]">
      <PreviewRow label="Current" value={from} />
      <ArrowDown aria-hidden="true" className="h-4 w-4 text-[#f8a27e]" />
      <PreviewRow label="New" value={to} />
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-[12px] font-medium uppercase tracking-wider text-[#cfe1fa]">{label}</p>
      <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[15px] font-medium">
        <AtSign aria-hidden="true" className="h-4 w-4 shrink-0 text-[#f8d3c3]" />
        <span className="truncate">{value?.trim() || "—"}</span>
      </p>
    </div>
  );
}
