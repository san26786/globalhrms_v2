import { Inbox, Plus, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DataTableEmptyProps {
  title?: string;
  description?: string;
  /** True when the emptiness is caused by an active search/filter, not truly-no-data. */
  isFiltered?: boolean;
  onAdd?: () => void;
  addLabel?: string;
  onClearFilters?: () => void;
}

export function DataTableEmpty({
  title,
  description,
  isFiltered = false,
  onAdd,
  addLabel = "Add",
  onClearFilters,
}: DataTableEmptyProps) {
  const Icon = isFiltered ? SearchX : Inbox;
  const resolvedTitle = title ?? (isFiltered ? "No matching results" : "No data yet");
  const resolvedDescription =
    description ??
    (isFiltered
      ? "Try adjusting your search or filters."
      : "Get started by adding your first record.");

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted brand:bg-[#fbe6dd] dark:bg-[#da5427]/15">
        <Icon className="h-6 w-6 text-muted-foreground brand:text-[#b4441f] dark:text-[#f8a27e]" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{resolvedTitle}</p>
        <p className="text-sm text-muted-foreground">{resolvedDescription}</p>
      </div>
      {isFiltered && onClearFilters && (
        <Button variant="outline" size="sm" onClick={onClearFilters}>
          Clear filters
        </Button>
      )}
      {!isFiltered && onAdd && (
        <Button size="sm" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          {addLabel}
        </Button>
      )}
    </div>
  );
}
