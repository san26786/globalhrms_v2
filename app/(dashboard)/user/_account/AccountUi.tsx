"use client";

// Shared look for the account pages in the header's profile menu (Profile, Update Username,
// Update Password, Security Questions): a hero card, icon-led fields, and a save card. Purely
// presentational — the pages' forms are still loaded and saved by ResourceFormPage.

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Controller, type FieldValues, type Path, type UseFormReturn } from "react-hook-form";
import {
  AtSign,
  Check,
  ChevronRight,
  CircleAlert,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import { BrandModule, fieldLabel, pageRise, pageStagger } from "@/components/dashboard/DashboardUi";

/** The account pages, as linked from the header's profile menu. */
export const ACCOUNT_PAGES = [
  { key: "profile", label: "Profile", href: "/user/profile", icon: UserRound },
  { key: "username", label: "Update username", href: "/user/changeusername", icon: AtSign },
  { key: "password", label: "Update password", href: "/user/changepassword", icon: KeyRound },
  { key: "security", label: "Security questions", href: "/user/security_questions", icon: ShieldCheck },
] as const;
export type AccountPageKey = (typeof ACCOUNT_PAGES)[number]["key"];

// Field looks, matching the sign-in pages. Text is at least 7:1 against its background.
const FIELD_BASE =
  "h-11 w-full rounded-xl border pl-10 text-[15px] outline-none transition-[background-color,border-color,box-shadow] duration-200";
const FIELD_EDITABLE =
  "border-[#e2e4ea] bg-[#f6f7f9] text-[#1a1818] placeholder:text-[#676879] hover:border-[#c9ccd6] hover:bg-white focus:border-[#da5427] focus:bg-white focus:ring-4 focus:ring-[#f9ddd1] dark:border-[#2a3550] dark:bg-[#0e1628] dark:text-[#f1f3f8] dark:placeholder:text-[#8b95ab] dark:hover:border-[#3a4767] dark:hover:bg-[#101a30] dark:focus:bg-[#0e1628] dark:focus:ring-[#da5427]/25";
const FIELD_INVALID =
  "border-rose-600 bg-white text-[#1a1818] focus:border-rose-600 focus:ring-4 focus:ring-rose-100 dark:border-rose-400 dark:bg-[#0e1628] dark:text-[#f1f3f8] dark:focus:ring-rose-400/20";
const FIELD_LOCKED =
  "cursor-not-allowed border-dashed border-[#c9ccd6] bg-[#eef0f4] text-[#323338] dark:border-white/15 dark:bg-white/5 dark:text-[#d5dae4]";
const ICON = "pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#535768] dark:text-[#aab3c5]";

/** Same rule the standard form applies to a required field. */
export const requiredRule = (field: DynamicField) => (field.required ? { required: `${field.label ?? ""} is required` } : {});

/** The field with this name, unless it is hidden. */
export const findField = (fields: DynamicField[], name: string) => fields.find((f) => f.name === name && !f.hidden);

/** Brand look, shared light/dark theme and page-turn entrance; sections inside rise in turn. */
export function AccountPage({ children }: { children: ReactNode }) {
  return (
    <BrandModule>
      <motion.div variants={pageStagger} initial="hidden" animate="show" className="mx-auto max-w-6xl space-y-6 p-2 sm:p-4">
        {children}
      </motion.div>
    </BrandModule>
  );
}

/** Round badge for the hero: initials, or an icon. */
export function HeroBadge({ icon: Icon, children }: { icon?: LucideIcon; children?: ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.15 }}
      className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f8a27e] to-[#da5427] text-[28px] font-semibold tracking-[-0.02em] text-white ring-4 ring-white/15"
    >
      {children ?? (Icon && <Icon aria-hidden="true" className="h-9 w-9" />)}
    </motion.div>
  );
}

/**
 * Dark blue hero: breadcrumb, badge, the page name (h1, small) over a friendly headline, optional
 * details and a side widget, then shortcuts to the other account pages.
 */
export function AccountHero({
  current,
  breadcrumb,
  eyebrow,
  heading,
  details,
  badge,
  aside,
}: {
  current: AccountPageKey;
  breadcrumb: string[];
  /** The page's name, e.g. "Update Password" (rendered as the page heading). */
  eyebrow: string;
  heading: ReactNode;
  details?: ReactNode;
  badge: ReactNode;
  aside?: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.section
      variants={pageRise}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a1f44] via-[#0b3a6e] to-[#0b4a85] p-6 text-white shadow-[0_24px_48px_-28px_rgba(6,27,49,0.75)] sm:p-8"
    >
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#da5427]/30 blur-3xl"
        animate={reduceMotion ? undefined : { x: [0, -24, 0], y: [0, 18, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-[#2f7fd6]/25 blur-3xl" />

      <div className="relative">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#cfe1fa]">
            {breadcrumb.map((crumb, i) =>
              i < breadcrumb.length - 1 ? (
                <li key={crumb} className="flex items-center gap-1.5">
                  {crumb}
                  <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
                </li>
              ) : (
                <li key={crumb} aria-current="page" className="font-medium text-white">
                  {crumb}
                </li>
              ),
            )}
          </ol>
        </nav>

        <div className="mt-6 flex flex-wrap items-center gap-5">
          {badge}
          <div className="min-w-0 flex-1">
            <h1 className="text-[13px] font-medium uppercase tracking-widest text-[#f8d3c3]">{eyebrow}</h1>
            <p className="mt-1 text-[28px] font-medium leading-tight tracking-[-0.03em] sm:text-[32px]">{heading}</p>
            {details && <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-[14px] text-[#d5e3f5]">{details}</div>}
          </div>
          {aside}
        </div>

        {/* Shortcuts to the other account pages (same links as the header's profile menu). */}
        <div className="mt-6 flex flex-wrap gap-2">
          {ACCOUNT_PAGES.filter((p) => p.key !== current).map((p) => (
            <Link
              key={p.key}
              href={p.href}
              className="group inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[14px] font-medium text-white transition-colors duration-200 hover:border-white/40 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <p.icon aria-hidden="true" className="h-4 w-4" />
              {p.label}
              <ChevronRight aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

function FieldLabel({ field }: { field: DynamicField }) {
  return (
    <label htmlFor={field.name} className={fieldLabel}>
      {field.label}
      {field.required && (
        <span aria-hidden="true" className="ml-0.5 text-rose-700 dark:text-rose-300">
          *
        </span>
      )}
    </label>
  );
}

export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-rose-700 animate-in fade-in slide-in-from-top-1 duration-200 dark:text-rose-300">
      <CircleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
      {children}
    </p>
  );
}

function FieldNote({ id, error, hint }: { id: string; error?: string; hint?: ReactNode }) {
  if (error) return <FieldError id={`${id}-error`}>{error}</FieldError>;
  if (!hint) return null;
  return (
    <p id={`${id}-hint`} className="mt-1.5 text-[13px] leading-snug text-[#535768] dark:text-[#aab3c5]">
      {hint}
    </p>
  );
}

const errorOf = <T extends FieldValues>(form: UseFormReturn<T>, name: string) =>
  (form.formState.errors as Record<string, { message?: unknown } | undefined>)[name]?.message as string | undefined;

/** Label, icon-led input, and the error (or a hint) underneath. Registers with the same rule as before. */
export function AccountTextField<T extends FieldValues>({
  form,
  field,
  icon: Icon,
  hint,
  className = "",
  type,
  trailing,
  autoComplete,
}: {
  form: UseFormReturn<T>;
  field: DynamicField | undefined;
  icon: LucideIcon;
  hint?: ReactNode;
  className?: string;
  /** Overrides the field's own type (the show/hide toggle on secret fields). */
  type?: string;
  trailing?: ReactNode;
  autoComplete?: string;
}) {
  if (!field) return null;
  const error = errorOf(form, field.name);
  const look = field.readOnly ? FIELD_LOCKED : error ? FIELD_INVALID : FIELD_EDITABLE;
  const describedBy = error ? `${field.name}-error` : hint ? `${field.name}-hint` : undefined;

  return (
    <div className={className}>
      <FieldLabel field={field} />
      <div className="relative">
        <Icon aria-hidden="true" className={ICON} />
        <input
          id={field.name}
          type={type ?? field.type}
          readOnly={field.readOnly}
          placeholder={field.placeholder}
          autoComplete={autoComplete}
          aria-required={field.required || undefined}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          className={`${FIELD_BASE} ${look} ${trailing ? "pr-11" : "pr-3.5"}`}
          {...form.register(field.name as Path<T>, requiredRule(field))}
        />
        {trailing}
      </div>
      <FieldNote id={field.name} error={error} hint={hint} />
    </div>
  );
}

/** A secret field (password, passcode, answer) with a button to show or hide what was typed. */
export function AccountSecretField<T extends FieldValues>({
  form,
  field,
  icon,
  hint,
  className,
  autoComplete,
}: {
  form: UseFormReturn<T>;
  field: DynamicField | undefined;
  icon: LucideIcon;
  hint?: ReactNode;
  className?: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  if (!field) return null;
  const Toggle = visible ? EyeOff : Eye;
  const what = (field.label ?? "value").toLowerCase();
  return (
    <AccountTextField
      form={form}
      field={field}
      icon={icon}
      hint={hint}
      className={className}
      autoComplete={autoComplete}
      type={visible ? "text" : field.type}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Hide ${what}` : `Show ${what}`}
          aria-pressed={visible}
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-[#535768] transition-colors hover:bg-slate-200/70 hover:text-[#1a1818] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e15425]/40 dark:text-[#aab3c5] dark:hover:bg-white/10 dark:hover:text-white"
        >
          <Toggle aria-hidden="true" className="h-4 w-4" />
        </button>
      }
    />
  );
}

/** Dropdown with the same Controller rule and string values as the standard select field. */
export function AccountSelectField<T extends FieldValues>({
  form,
  field,
  icon: Icon,
  className = "",
  placeholder = "Select an option",
}: {
  form: UseFormReturn<T>;
  field: DynamicField | undefined;
  icon: LucideIcon;
  className?: string;
  placeholder?: string;
}) {
  if (!field) return null;
  const error = errorOf(form, field.name);
  return (
    <div className={className}>
      <FieldLabel field={field} />
      <Controller
        name={field.name as Path<T>}
        control={form.control}
        rules={requiredRule(field)}
        render={({ field: f }) => (
          <Select onValueChange={f.onChange} value={f.value === undefined || f.value === null ? "" : String(f.value)}>
            <SelectTrigger
              id={field.name}
              aria-required={field.required || undefined}
              aria-invalid={!!error || undefined}
              aria-describedby={error ? `${field.name}-error` : undefined}
              className={`relative h-11 w-full cursor-pointer rounded-xl pl-10 pr-3.5 text-left text-[15px] shadow-none ${error ? FIELD_INVALID : FIELD_EDITABLE} data-[placeholder]:text-[#676879] dark:data-[placeholder]:text-[#8b95ab]`}
            >
              <Icon aria-hidden="true" className={ICON} />
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {(field.options ?? []).map((option) => (
                <SelectItem key={String(option.value)} value={String(option.value)} className="py-2">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      <FieldNote id={field.name} error={error} />
    </div>
  );
}

/** White card with a title, an icon chip and an optional line of help. */
export function AccountCard({
  title,
  icon: Icon,
  tone = "orange",
  intro,
  children,
  className = "",
}: {
  title: string;
  icon: LucideIcon;
  tone?: "orange" | "blue" | "emerald";
  intro?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const chip = {
    orange: "bg-[#fbe6dd] text-[#b4441f] dark:bg-[#da5427]/15 dark:text-[#f8a27e]",
    blue: "bg-[#dbe8f8] text-[#0b5394] dark:bg-[#8cb8f0]/15 dark:text-[#8cb8f0]",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  }[tone];
  return (
    <motion.section
      variants={pageRise}
      className={`overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow duration-300 hover:shadow-[0_18px_40px_-24px_rgba(6,27,49,0.3)] dark:bg-[#111a2e] dark:ring-white/10 ${className}`}
    >
      <header className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4 dark:border-white/10">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${chip}`}>
          <Icon aria-hidden="true" className="h-4 w-4" />
        </span>
        <h2 className="text-[15px] font-semibold text-[#1a1818] dark:text-[#f1f3f8]">{title}</h2>
      </header>
      <div className="p-5 sm:p-6">
        {intro && <p className="mb-5 text-[14px] leading-relaxed text-[#535768] dark:text-[#aab3c5]">{intro}</p>}
        {children}
      </div>
    </motion.section>
  );
}

/** Short list of good-to-know points with check marks. */
export function TipsCard({ title = "Good to know", tips }: { title?: string; tips: ReactNode[] }) {
  return (
    <AccountCard title={title} icon={ShieldCheck} tone="blue">
      <ul className="space-y-3">
        {tips.map((tip, i) => (
          <li key={i} className="flex gap-2.5 text-[14px] leading-snug text-[#323338] dark:text-[#d5dae4]">
            <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </AccountCard>
  );
}

/** Whether there is anything to save, then the submit and cancel buttons. Must sit inside the form. */
export function SaveCard({
  dirty,
  errorCount,
  submitting,
  submitLabel,
  idleLabel = "Nothing to save yet",
  onCancel,
}: {
  dirty: boolean;
  errorCount: number;
  submitting: boolean;
  submitLabel: string;
  /** Shown while nothing has been changed. */
  idleLabel?: string;
  onCancel: () => void;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.section
      variants={pageRise}
      className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:bg-[#111a2e] dark:ring-white/10"
    >
      <SaveState dirty={dirty} errorCount={errorCount} idleLabel={idleLabel} />
      <div className="mt-4 space-y-2.5">
        <motion.button
          type="submit"
          disabled={submitting}
          whileHover={submitting || reduceMotion ? undefined : { y: -2 }}
          whileTap={submitting || reduceMotion ? undefined : { scale: 0.98 }}
          className="group relative flex h-12 w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full bg-[#e15425] px-6 text-[16px] font-semibold text-white shadow-[0_14px_28px_-16px_rgba(225,84,37,0.95)] transition-colors duration-200 hover:bg-[#c2431c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e15425]/30 disabled:cursor-wait disabled:opacity-85"
        >
          {/* light sweep on hover, like the sign-in button */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/25 transition-transform duration-700 ease-[cubic-bezier(0.515,0.147,0.25,1)] group-hover:translate-x-[400%]"
          />
          <span className="relative flex items-center gap-2">
            {submitting ? (
              <>
                <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Check aria-hidden="true" className="h-5 w-5" />
                {submitLabel}
              </>
            )}
          </span>
        </motion.button>
        <button
          type="button"
          onClick={onCancel}
          className="h-11 w-full cursor-pointer rounded-full border border-slate-300 bg-white text-[15px] font-medium text-[#1a1818] transition-colors duration-200 hover:border-slate-400 hover:bg-[#f6f7f9] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0b5394]/20 dark:border-white/15 dark:bg-transparent dark:text-[#f1f3f8] dark:hover:border-white/25 dark:hover:bg-white/5"
        >
          Cancel
        </button>
      </div>
    </motion.section>
  );
}

function SaveState({ dirty, errorCount, idleLabel }: { dirty: boolean; errorCount: number; idleLabel: string }) {
  if (errorCount > 0) {
    return (
      <p className="flex items-center gap-2 text-[14px] font-medium text-rose-700 dark:text-rose-300">
        <CircleAlert aria-hidden="true" className="h-4 w-4" />
        {errorCount === 1 ? "1 field needs your attention" : `${errorCount} fields need your attention`}
      </p>
    );
  }
  return dirty ? (
    <p className="flex items-center gap-2 text-[14px] font-medium text-amber-900 dark:text-amber-300">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
      </span>
      You have unsaved changes
    </p>
  ) : (
    <p className="flex items-center gap-2 text-[14px] font-medium text-emerald-800 dark:text-emerald-300">
      <Check aria-hidden="true" className="h-4 w-4" />
      {idleLabel}
    </p>
  );
}
