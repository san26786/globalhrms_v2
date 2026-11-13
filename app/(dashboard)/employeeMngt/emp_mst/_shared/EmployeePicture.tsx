"use client";

import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authFetch } from "@/lib/auth/authFetch";

/**
 * CI emp_mst initForm "empPicture" (next to Employee Code): the employee's current picture and a file input to change
 * it; on save CI stored a new emp_picture row (the newest is the one shown). Here the picture is shown from — and saved
 * through — the "My Picture" record screen (lib/employeeMngt/hub/screens/empPicture.ts): `uploadEmployeePicture` adds a
 * picture record for the employee and uploads the file to it.
 */
const API = "/api/employeeMngt/empPicture";

export async function uploadEmployeePicture(empId: string | number, file: File): Promise<string | null> {
  const res = await authFetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ EMP_ID: String(empId) }) });
  const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string; data?: { id?: number } } | null;
  const id = json?.data?.id;
  if (!res.ok || !json?.success || !id) return json?.message ?? "The picture record could not be created.";
  const body = new FormData();
  body.append("file", file);
  const up = await authFetch(`${API}/${id}/file`, { method: "POST", body });
  const upJson = (await up.json().catch(() => null)) as { success?: boolean; message?: string } | null;
  return up.ok && upJson?.success ? null : (upJson?.message ?? "The picture could not be uploaded.");
}

export default function EmployeePicture({ empId, onPick }: { empId?: string; onPick: (file: File | undefined) => void }) {
  const [current, setCurrent] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // The newest picture of the employee.
  useEffect(() => {
    if (!empId) return;
    let live = true;
    let url: string | null = null;
    (async () => {
      const res = await authFetch(`${API}?emp=${encodeURIComponent(empId)}&limit=1`);
      const json = (await res.json().catch(() => null)) as { success?: boolean; data?: { rows?: Array<{ id: number }> } } | null;
      const id = json?.data?.rows?.[0]?.id;
      if (!id || !live) return;
      const file = await authFetch(`${API}/${id}/file`);
      if (!file.ok || !live) return;
      url = URL.createObjectURL(await file.blob());
      setCurrent(url);
    })().catch(() => undefined);
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [empId]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const shown = preview ?? current;
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-3xl border bg-white p-4 shadow-sm brand:border-slate-200 dark:border-white/10 dark:bg-[#111a2e]">
      {/* eslint-disable-next-line @next/next/no-img-element -- an authenticated blob URL */}
      {shown ? <img src={shown} alt="Employee picture" className="h-24 w-24 rounded-xl border border-slate-200 object-cover dark:border-white/10" /> : (
        <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-400 dark:border-white/15">No picture</div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="empPicture" className="text-sm font-medium text-slate-700 dark:text-[#d5dae4]">
          {current ? "Change Picture" : "Picture"}
        </Label>
        <Input
          id="empPicture"
          type="file"
          accept=".jpg,.jpeg,.png,.gif,.bmp,.jfif"
          className="h-9"
          onChange={(e) => {
            const file = e.target.files?.[0];
            onPick(file);
            setPreview(file ? URL.createObjectURL(file) : null);
          }}
        />
        <p className="text-xs text-slate-500">Saved with the employee (jpg, png, gif, bmp; up to 10 MB).</p>
      </div>
    </div>
  );
}
