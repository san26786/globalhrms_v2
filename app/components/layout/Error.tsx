"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export default function Error({
  title = "Something went wrong",
  message = "An unexpected error occurred.",
  onRetry,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 py-12 text-center">
      <AlertCircle className="mb-4 h-12 w-12 text-destructive" />

      <h2 className="text-lg font-semibold text-destructive">
        {title}
      </h2>

      <p className="mt-2 max-w-lg text-muted-foreground">
        {message}
      </p>

      {onRetry && (
        <Button
          className="mt-6"
          onClick={onRetry}
        >
          Retry
        </Button>
      )}
    </div>
  );
}