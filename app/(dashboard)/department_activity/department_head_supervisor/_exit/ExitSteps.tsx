"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authFetch } from "@/lib/auth/authFetch";
import { EXIT_STEPS, type ExitStepKey } from "@/lib/employeeMngt/hub/defs/exit_clearance";
import { HUB_SCREENS, hubBase } from "@/lib/employeeMngt/hub/hubTypes";
import HubForm from "../../../employeeMngt/_hub/HubForm";

/**
 * CI department_activity/* (exit_form_tabs_v): an employee's exit clearance, one department per tab, in
 * CI's "Save And Next" order (Department Head / Supervisor → G&A → Finance → Facilities / IT → HR → the
 * clearance list). A step opens its saved record, or a new one.
 */
const LIST = hubBase("exit_clearance");

/** The step's own page for the employee: picks edit or add (steps 2–5). */
export const stepEntry = (key: ExitStepKey, emp: string) => `${hubBase(key)}?emp=${encodeURIComponent(emp)}`;

/** Where a save of `key` goes: the next department, or back to the list after the last one. */
export function nextAfter(key: ExitStepKey, emp: string): string {
  const i = EXIT_STEPS.findIndex((s) => s.key === key);
  const following = EXIT_STEPS[i + 1];
  return following ? stepEntry(following.key, emp) : LIST;
}

/** The employee's live record of the step, if any. */
async function stepRecord(key: ExitStepKey, emp: string): Promise<number | null> {
  const res = await authFetch(`/api/employeeMngt/${key}?${new URLSearchParams({ emp, page: "1", limit: "1" })}`);
  const json = (await res.json().catch(() => null)) as { success?: boolean; data?: Array<{ id: number }>; message?: string } | null;
  if (!res.ok || !json?.success) throw new Error(json?.message ?? "Could not load the exit clearance.");
  return json.data?.[0]?.id ?? null;
}

const formHref = (key: ExitStepKey, emp: string, id: number | null) =>
  `${hubBase(key)}/${id ? `edit/${id}` : "add"}?emp=${encodeURIComponent(emp)}`;

/** The department tabs for one employee; a tab not yet saved shows as pending. */
export function ExitStepTabs({ emp, current }: { emp: string; current: ExitStepKey }) {
  const [ids, setIds] = useState<Partial<Record<ExitStepKey, number | null>>>({});
  useEffect(() => {
    let cancelled = false;
    Promise.all(EXIT_STEPS.map(async (s) => [s.key, await stepRecord(s.key, emp).catch(() => null)] as const)).then(
      (pairs) => !cancelled && setIds(Object.fromEntries(pairs)),
    );
    return () => {
      cancelled = true;
    };
  }, [emp]);

  return (
    <nav className="flex flex-wrap gap-1 border-b border-slate-200 px-4 pt-3 dark:border-white/10" aria-label="Exit clearance departments">
      {EXIT_STEPS.map((s) => {
        const active = s.key === current;
        const saved = ids[s.key];
        return (
          <Link
            key={s.key}
            href={formHref(s.key, emp, saved ?? null)}
            aria-current={active ? "page" : undefined}
            className={`rounded-t-md px-3 py-2 text-sm ${
              active
                ? "border border-b-0 border-slate-200 bg-white font-semibold text-[#0b5394] dark:border-white/10 dark:bg-transparent dark:text-[#8cb8f0]"
                : "text-[#535768] hover:text-[#0b5394] dark:text-[#aab3c5]"
            }`}
          >
            {s.key === "exit_clearance" ? "Department Head/Supervisor" : HUB_SCREENS[s.key].title}
            {saved === null ? <span className="ml-1 text-xs text-amber-600">(pending)</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** A department's form: the tabs (once the employee is known) and the record, saving on to the next department. */
export function ExitStepForm({ step, mode, id, emp }: { step: ExitStepKey; mode: "add" | "edit"; id?: string; emp?: string }) {
  return (
    <>
      {emp ? <ExitStepTabs emp={emp} current={step} /> : null}
      <HubForm screen={step} mode={mode} id={id} emp={emp} back={LIST} next={(employee) => nextAfter(step, employee)} />
    </>
  );
}

/** A step's own URL (?emp=): opens the employee's record of that department, or a new one. */
export function ExitStepEntry({ step, emp }: { step: ExitStepKey; emp?: string }) {
  const router = useRouter();
  useEffect(() => {
    if (!emp) {
      router.replace(LIST);
      return;
    }
    stepRecord(step, emp)
      .then((id) => router.replace(formHref(step, emp, id)))
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : "Could not load the exit clearance.");
        router.replace(LIST);
      });
  }, [step, emp, router]);
  return <p className="p-6 text-sm text-gray-400">Loading…</p>;
}
