"use client";

import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import ResourceListPage from "@/components/resource/ResourceListPage";

interface LastLoginRow {
  id: number;
  userName: string | null;
  lastLoginAt: string;
  ipAddress: string | null;
  organisation: string | null;
  brand: string | null;
  location: string | null;
  userAgent: string | null;
}

const formatDate = (iso: string) => new Date(iso).toLocaleString();

/** CI systmInfoMgr/user_lst_login::index() — login history (own / organisation / all by admin level). */
export default function LastLoginListPage() {
  const router = useRouter();
  return (
    <ResourceListPage<LastLoginRow>
      title="Last Login Details"
      entity="user-lst-login"
      objectName="user_last_login_dtl_vw"
      apiPath="/api/systmInfoMgr/user_lst_login"
      basePath="/systmInfoMgr/user_lst_login"
      getId={(r) => r.id}
      readOnly
      searchPlaceholder="Search IP, location or browser..."
      extraRowActions={[
        { label: "View", icon: Eye, onClick: (r) => router.push(`/systmInfoMgr/user_lst_login/LastLoginDetails/${r.id}`) },
      ]}
      columns={[
        { key: "userName", header: "User Name", sortKey: "USER_ID" },
        { key: "lastLoginAt", header: "Last Login At", sortKey: "LAST_LOGIN_AT", cell: (r) => formatDate(r.lastLoginAt) },
        { key: "ipAddress", header: "Last Logged In IP" },
        { key: "organisation", header: "Organisation" },
        { key: "brand", header: "Brand" },
        { key: "location", header: "Approx. Location" },
        { key: "userAgent", header: "User Agent" },
      ]}
    />
  );
}
