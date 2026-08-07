"use client";

import { Loader2 } from "lucide-react";

interface Props {
  text?: string;
}

export default function Loader({
  text = "Loading...",
}: Props) {
  return (
    <div className="flex min-h-[250px] flex-col items-center justify-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <span className="text-muted-foreground">
        {text}
      </span>
    </div>
  );
}