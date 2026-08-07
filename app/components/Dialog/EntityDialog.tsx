"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { ReactNode } from "react";

interface EntityDialogProps {
  open: boolean;
  title: string;

  children: ReactNode;

  loading?: boolean;
  submitText?: string;

  size?: "sm" | "md" | "lg" | "xl" | "full";

  onClose: () => void;
  onSubmit?: () => void;
}

const dialogSizes = {
  sm: "sm:max-w-md",
  md: "sm:max-w-xl",
  lg: "sm:max-w-3xl",
  xl: "sm:max-w-5xl",
  full: "sm:max-w-7xl",
};

export default function EntityDialog({
  open,
  title,
  children,
  loading = false,
  submitText = "Save",
  size = "lg",
  onClose,
  onSubmit,
}: EntityDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !loading) onClose();
      }}
    >
      <DialogContent
        className={`${dialogSizes[size]} max-h-[90vh] overflow-y-auto`}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="py-4">{children}</div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={loading}
            onClick={onClose}
          >
            Cancel
          </Button>

          {onSubmit && (
            <Button
              disabled={loading}
              onClick={onSubmit}
            >
              {loading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}

              {submitText}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}