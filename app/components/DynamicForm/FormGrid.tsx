"use client";

import React, { ReactNode } from "react";

export interface FormGridProps {
  children: ReactNode;

  /**
   * Number of grid columns
   * Default: 12
   */
  columns?: 1 | 2 | 3 | 4 | 6 | 12;

  /**
   * Gap between fields
   */
  gap?: "sm" | "md" | "lg";

  className?: string;
}

interface FormGridItemProps {
  children: ReactNode;

  /**
   * Grid span (1-12)
   */
  span?: number;

  className?: string;
}

const columnClassMap = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  6: "grid-cols-6",
  12: "grid-cols-12",
};

const gapClassMap = {
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
};

export default function FormGrid({
  children,
  columns = 12,
  gap = "md",
  className = "",
}: FormGridProps) {
  return (
    <div
      className={`
        grid
        ${columnClassMap[columns]}
        ${gapClassMap[gap]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

export function FormGridItem({
  children,
  span = 12,
  className = "",
}: FormGridItemProps) {
  const safeSpan = Math.min(Math.max(span, 1), 12);

  return (
    <div
      className={`col-span-${safeSpan} ${className}`}
    >
      {children}
    </div>
  );
}