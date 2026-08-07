"use client";

import { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export default function PageContainer({
  children,
  className = "",
}: PageContainerProps) {
  return (
    <div
      className={`
        flex flex-col
        gap-4
        p-4
        bg-slate-50
        min-h-full
        ${className}
      `}
    >
      {children}
    </div>
  );
}