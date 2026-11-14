"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckSquare, Copy, CopyPlus, Eye, FolderCog, ListChecks, Loader2, PlusCircle, RefreshCw, Send, ThumbsDown, ThumbsUp, type LucideIcon } from "lucide-react";
import { toast } from "sonner";

import EntityDialog from "@/components/Dialog/EntityDialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { authFetch } from "@/lib/auth/authFetch";
import type { FormButton, FormButtonIcon } from "@/lib/form-init/formExtras";

/**
 * CI formview_v $data['buttons'] for an initForm payload: one button per workflow action. A button
 * with a `prompt` first asks for a text in a dialog (CI's modal form, e.g. Approver Comments); one
 * with `confirm` asks first. The endpoint answers { message, redirect? }; `onDone` decides where to go.
 */
const ICONS: Record<FormButtonIcon, LucideIcon> = {
  approve: ThumbsUp,
  reject: ThumbsDown,
  send: Send,
  copy: Copy,
  clone: CopyPlus,
  check: CheckSquare,
  plus: PlusCircle,
  refresh: RefreshCw,
  view: Eye,
  projects: FolderCog,
  tasks: ListChecks,
};

const VARIANTS: Record<NonNullable<FormButton["variant"]>, string> = {
  primary: "bg-blue-600 hover:bg-blue-700 text-white brand:bg-[#0b5394] brand:hover:bg-[#094679]",
  success: "bg-emerald-600 hover:bg-emerald-700 text-white",
  danger: "bg-rose-600 hover:bg-rose-700 text-white",
  default:
    "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 brand:text-[#323338] dark:border-white/10 dark:bg-transparent dark:text-[#d5dae4] dark:hover:bg-white/5",
};

export interface FormButtonResult {
  button: FormButton;
  message?: string;
  redirect?: string;
}

export default function FormButtonBar({ buttons, onDone }: { buttons: FormButton[]; onDone: (r: FormButtonResult) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [prompting, setPrompting] = useState<FormButton | null>(null);
  const [text, setText] = useState("");

  if (!buttons.length) return null;

  const run = async (button: FormButton, body: Record<string, unknown> = {}) => {
    if (!button.url) return;
    setBusy(button.key);
    try {
      const res = await authFetch(button.url, {
        method: button.method ?? "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string; data?: { message?: string; redirect?: string } } | null;
      if (!res.ok || !json?.success) throw new Error(json?.message ?? `${button.label} failed.`);
      const message = json.data?.message ?? json.message;
      if (message) toast.success(message);
      setPrompting(null);
      onDone({ button, message, redirect: json.data?.redirect });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `${button.label} failed.`);
    } finally {
      setBusy(null);
    }
  };

  const start = (button: FormButton) => {
    if (button.prompt) {
      setText(button.prompt.value ?? "");
      setPrompting(button);
      return;
    }
    if (button.confirm && !window.confirm(button.confirm)) return;
    void run(button);
  };

  const submitPrompt = () => {
    if (!prompting?.prompt) return;
    if (prompting.prompt.required && !text.trim()) {
      toast.error(`${prompting.prompt.label} is required.`);
      return;
    }
    void run(prompting, { [prompting.prompt.name]: text });
  };

  return (
    <>
      <div className="flex flex-wrap gap-2 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#111a2e]">
        {buttons.map((b) => {
          const Icon = b.icon ? ICONS[b.icon] : null;
          if (b.href) {
            return (
              <Link
                key={b.key}
                href={b.href}
                className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold ${VARIANTS[b.variant ?? "default"]}`}
              >
                {Icon ? <Icon className="h-4 w-4" /> : null}
                {b.label}
              </Link>
            );
          }
          return (
            <Button
              key={b.key}
              type="button"
              disabled={busy !== null}
              onClick={() => start(b)}
              className={`h-9 rounded-full px-4 text-sm font-semibold ${VARIANTS[b.variant ?? "default"]}`}
            >
              {busy === b.key ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
              {b.label}
            </Button>
          );
        })}
      </div>

      <EntityDialog
        open={prompting !== null}
        title={prompting?.prompt?.label ?? ""}
        loading={busy !== null}
        submitText="Submit"
        size="md"
        onClose={() => setPrompting(null)}
        onSubmit={submitPrompt}
      >
        <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-[#d5dae4]">
          {prompting?.prompt?.label}
          <Textarea className="w-full" value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={5000} />
        </label>
      </EntityDialog>
    </>
  );
}
