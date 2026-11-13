"use client";

import { useEffect, useState } from "react";

import { authFetch } from "@/lib/auth/authFetch";
import EmployeeForm from "../_shared/EmployeeForm";

/**
 * CI employeeMngt/emp_mst/myInfo — a normal user's own Personal form (editEmployeeMst for the employee linked to the
 * login), with their tabs, picture and "Send Resignation Letter". The employee comes from GET /api/employeeMngt/emp_mst/me.
 */
export default function MyInfoPage() {
  const [state, setState] = useState<{ id?: string; error?: string } | null>(null);

  useEffect(() => {
    let live = true;
    authFetch("/api/employeeMngt/emp_mst/me")
      .then((r) => r.json())
      .then((json: { success?: boolean; message?: string; data?: { id?: number } }) => {
        if (!live) return;
        if (json?.success && json.data?.id) setState({ id: String(json.data.id) });
        else setState({ error: json?.message ?? "No employee record is linked to your login." });
      })
      .catch(() => live && setState({ error: "Your employee record could not be loaded." }));
    return () => {
      live = false;
    };
  }, []);

  if (!state) return <p className="p-6 text-sm text-gray-400">Loading…</p>;
  if (state.error || !state.id) return <p className="p-6 text-sm text-red-500">{state.error}</p>;
  return <EmployeeForm mode="edit" screen="all" id={state.id} variant="me" />;
}
