"use client";

import { ReactNode } from "react";
import Breadcrumb from "@/components/layout/Breadcrumb";
import PageTitle from "@/components/layout/PageTitle";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  breadcrumbs?: {
    label: string;
    href?: string;
  }[];
  actions?: ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  description,
  breadcrumbs = [],
  actions,
}: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b pb-4 md:flex-row md:items-center md:justify-between">
      <div className="space-y-2">
        <Breadcrumb items={breadcrumbs} />
        <PageTitle title={title} subtitle={subtitle} description={description} />
      </div>

      {actions && <div>{actions}</div>}
    </div>
  );
}