"use client";

import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: string | number | boolean;
}

export default function StatusBadge({
  status,
}: StatusBadgeProps) {
  const getStatus = () => {
    if (typeof status === "boolean") {
      return status
        ? {
            label: "Active",
            variant: "default" as const,
          }
        : {
            label: "Inactive",
            variant: "secondary" as const,
          };
    }

    switch (String(status).toLowerCase()) {
      case "active":
      case "1":
        return {
          label: "Active",
          variant: "default" as const,
        };

      case "inactive":
      case "0":
        return {
          label: "Inactive",
          variant: "secondary" as const,
        };

      case "pending":
        return {
          label: "Pending",
          variant: "outline" as const,
        };

      case "draft":
        return {
          label: "Draft",
          variant: "secondary" as const,
        };

      case "approved":
        return {
          label: "Approved",
          variant: "default" as const,
        };

      case "rejected":
        return {
          label: "Rejected",
          variant: "destructive" as const,
        };

      default:
        return {
          label: String(status),
          variant: "outline" as const,
        };
    }
  };

  const current = getStatus();

  return (
    <Badge variant={current.variant}>
      {current.label}
    </Badge>
  );
}