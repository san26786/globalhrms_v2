"use client";

import { motion, useReducedMotion } from "motion/react";
import { Controller, type Path } from "react-hook-form";
import { AtSign, Clock3, KeyRound, Lock, Mail, ShieldCheck, SlidersHorizontal, UserRound } from "lucide-react";

import type { ResourceFormRenderProps } from "@/components/resource/ResourceFormPage";
import { EASE } from "@/components/auth/AuthUi";
import {
  AccountCard,
  AccountHero,
  AccountPage,
  AccountSecretField,
  AccountTextField,
  FieldError,
  HeroBadge,
  SaveCard,
  findField,
  requiredRule,
} from "../_account/AccountUi";

/** CI user/profile — the logged-in user's own details (username is read-only). */
export interface ProfileForm {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  tPin: string;
  memorableWord: string;
  localTime: boolean;
}

const isFilled = (value: unknown) => (typeof value === "string" ? value.trim() !== "" : value != null && value !== false);

/** The profile form in its own layout; loading and saving are done by ResourceFormPage. */
export default function ProfileView({
  form,
  title,
  breadcrumb,
  mode,
  fields,
  submitting,
  onSubmit,
  onCancel,
}: ResourceFormRenderProps<ProfileForm>) {
  const reduceMotion = useReducedMotion();
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = form;
  const values = watch();
  const field = (name: keyof ProfileForm) => findField(fields, name);

  const fullName = `${values.firstName ?? ""} ${values.lastName ?? ""}`.trim();
  const initials = `${values.firstName?.trim()[0] ?? ""}${values.lastName?.trim()[0] ?? ""}`.toUpperCase() || values.username?.trim()[0]?.toUpperCase();
  const required = fields.filter((f) => f.required && !f.hidden);
  const filled = required.filter((f) => isFilled(values[f.name as keyof ProfileForm])).length;
  const localTime = field("localTime");

  return (
    <AccountPage>
      {/* Who you are, live as you type */}
      <AccountHero
        current="profile"
        breadcrumb={[...breadcrumb, mode === "add" ? "Add" : "Edit"]}
        eyebrow={title}
        heading={<span className="block truncate">{fullName || values.username || "Your profile"}</span>}
        badge={<HeroBadge icon={UserRound}>{initials || undefined}</HeroBadge>}
        details={
          <>
            {values.username && (
              <span className="flex items-center gap-1.5">
                <AtSign aria-hidden="true" className="h-4 w-4" />
                {values.username}
              </span>
            )}
            {values.email && (
              <span className="flex min-w-0 items-center gap-1.5">
                <Mail aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span className="truncate">{values.email}</span>
              </span>
            )}
          </>
        }
        aside={required.length > 0 && <CompletionRing done={filled} total={required.length} />}
      />

      <motion.form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="space-y-6">
          <AccountCard title="Personal details" icon={UserRound} intro="How you appear to colleagues across Global HR.">
            <div className="grid gap-5 sm:grid-cols-2">
              <AccountTextField form={form} field={field("firstName")} icon={UserRound} />
              <AccountTextField form={form} field={field("lastName")} icon={UserRound} />
              <AccountTextField form={form} field={field("email")} icon={Mail} className="sm:col-span-2" />
              <AccountTextField
                form={form}
                field={field("username")}
                icon={Lock}
                className="sm:col-span-2"
                hint="Your username can't be edited here. Use Update username above to change it."
              />
            </div>
          </AccountCard>

          <AccountCard title="Sign-in security" icon={ShieldCheck} tone="blue" intro="Your passcode and memorable word help keep your account secure.">
            <div className="grid gap-5 sm:grid-cols-2">
              <AccountSecretField form={form} field={field("tPin")} icon={Lock} hint="Exactly 6 digits." />
              <AccountTextField form={form} field={field("memorableWord")} icon={KeyRound} />
            </div>
          </AccountCard>
        </div>

        <div className="space-y-6 lg:sticky lg:top-24">
          {localTime && (
            <AccountCard title="Preferences" icon={SlidersHorizontal} tone="emerald">
              <Controller
                name={localTime.name as Path<ProfileForm>}
                control={control}
                defaultValue={false}
                rules={requiredRule(localTime)}
                render={({ field: f }) => (
                  <button
                    type="button"
                    id={localTime.name}
                    ref={f.ref}
                    role="switch"
                    aria-checked={!!f.value}
                    aria-labelledby={`${localTime.name}-label`}
                    onClick={() => f.onChange(!f.value)}
                    onBlur={f.onBlur}
                    className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-[#f6f7f9] p-4 text-left transition-colors duration-200 hover:border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e15425]/25 dark:border-white/10 dark:bg-[#0e1628] dark:hover:border-white/20 dark:hover:bg-[#101a30]"
                  >
                    <span className="flex items-center gap-3">
                      <Clock3 aria-hidden="true" className="h-5 w-5 text-[#0b5394] dark:text-[#8cb8f0]" />
                      <span>
                        <span id={`${localTime.name}-label`} className="block text-[15px] font-medium text-[#1a1818] dark:text-[#f1f3f8]">
                          {localTime.label}
                        </span>
                        <span className="block text-[13px] text-[#535768] dark:text-[#aab3c5]">{f.value ? "On" : "Off"}</span>
                      </span>
                    </span>
                    <span className={`relative inline-flex h-7 w-12 shrink-0 rounded-full p-1 transition-colors duration-300 ${f.value ? "bg-[#e15425]" : "bg-slate-400 dark:bg-white/25"}`}>
                      <motion.span
                        className="h-5 w-5 rounded-full bg-white shadow"
                        animate={{ x: f.value ? 20 : 0 }}
                        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 32 }}
                      />
                    </span>
                  </button>
                )}
              />
              {errors.localTime?.message && <FieldError id={`${localTime.name}-error`}>{String(errors.localTime.message)}</FieldError>}
            </AccountCard>
          )}

          {/* Save / cancel, always in reach on large screens. */}
          <SaveCard
            dirty={isDirty}
            errorCount={Object.keys(errors).length}
            submitting={submitting}
            submitLabel="Update profile"
            idleLabel="Everything is up to date"
            onCancel={onCancel}
          />
        </div>
      </motion.form>
    </AccountPage>
  );
}

/** Ring in the hero showing how many required details are filled in. */
function CompletionRing({ done, total }: { done: number; total: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const share = total ? done / total : 1;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15 backdrop-blur-sm">
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden="true">
          <circle cx="32" cy="32" r={radius} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="6" />
          <motion.circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            stroke="#f8a27e"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - share) }}
            transition={{ duration: 0.9, ease: EASE }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[14px] font-semibold tabular-nums">{Math.round(share * 100)}%</span>
      </div>
      <div className="text-[14px] leading-snug">
        <p className="font-medium">{done === total ? "Profile complete" : "Almost there"}</p>
        <p className="text-[#d5e3f5]">
          {done} of {total} details filled
        </p>
      </div>
    </div>
  );
}
