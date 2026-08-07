"use client";

import { Button } from "@/components/ui/button";

interface Props {
  loading?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
}

export default function FormActions({
  loading,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  onCancel,
}: Props) {
  return (
    <div className="flex justify-end gap-3 pt-6">
      {onCancel && (
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          {cancelLabel}
        </Button>
      )}

      <Button type="submit" disabled={loading}>
        {loading ? "Saving..." : submitLabel}
      </Button>
    </div>
  );
}