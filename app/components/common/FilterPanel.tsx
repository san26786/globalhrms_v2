"use client";

import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface FilterPanelProps {
  children: ReactNode;
  className?: string;
}

export default function FilterPanel({
  children,
  className = "",
}: FilterPanelProps) {
  return (
    <Card className={className}>
      <CardContent className="flex flex-wrap gap-4 p-4">
        {children}
      </CardContent>
    </Card>
  );
}