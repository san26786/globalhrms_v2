"use client";

import { useEffect, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/DataTable";
import BreadcrumbHeader from "@/lib/page-builder/pageBreadcrumbHeader";
import { authFetch } from "@/lib/auth/authFetch";

interface OnlineUser {
  id: number;
  username: string;
  name: string;
  brand: string | null;
  sessions: number;
}

const columns: ColumnDef<OnlineUser, unknown>[] = [
  { accessorKey: "username", header: "Username" },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "brand", header: "Brand" },
  { accessorKey: "sessions", header: "Active Sessions" },
];

/** CI user/login_details — users currently online (sysadmin: all, admin: own brand, user: self). */
export default function LoginDetailsPage() {
  const [rows, setRows] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch("/api/user/login_details")
      .then((res) => res.json())
      .then((json) => (json.success ? setRows(json.data) : setError(json.message)))
      .catch(() => setError("Failed to load online users."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container mx-auto p-4 space-y-6">
      <BreadcrumbHeader entity="login-details" title="Login Details" filename="login-details" data={rows} />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <DataTable columns={columns} data={rows} isLoading={loading} getRowId={(r) => String(r.id)} searchPlaceholder="Search users..." />
    </div>
  );
}
