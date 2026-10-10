"use client";

import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import ResourceListPage from "@/components/resource/ResourceListPage";

interface DomainRow {
  id: number;
  name: string;
  description: string | null;
  organisation: string | null;
  brandName: string | null;
  requestedBy: string | null;
}

/** CI user/user_domain::index() — list of user_domain_vw; the "Role Master" tab lists the domain's roles. */
export default function UserDomainPage() {
  const router = useRouter();
  return (
    <ResourceListPage<DomainRow>
      title="User Domain"
      entity="user-domain"
      objectName="user_domain_vw"
      apiPath="/api/user/user_domain"
      basePath="/user/user_domain"
      getId={(r) => r.id}
      searchPlaceholder="Search domain name or description..."
      extraRowActions={[{ label: "Role Master", icon: ShieldCheck, onClick: (r) => router.push(`/user/role_master?domainId=${r.id}`) }]}
      columns={[
        { key: "name", header: "Domain Name", sortKey: "DMN_NM" },
        { key: "description", header: "Description" },
        { key: "organisation", header: "Organisation" },
        { key: "brandName", header: "Brand", sortKey: "OA_BRAND_ID" },
        { key: "requestedBy", header: "Requested By" },
      ]}
    />
  );
}
